import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from '../../src/config/index.js';
import { AiUnavailableError } from '../../src/modules/ai/geminiClient.js';
import { narrateRecap, selectTool } from '../../src/modules/ai/geminiMatchQueryClient.js';

function toolSelection() {
  return {
    tool: 'LAST_N_OVERS',
    inningsNumber: null,
    overNumber: null,
    comparisonOver1: null,
    comparisonOver2: null,
    playerId: null,
    eventTypes: null,
    minimumImportance: null,
    startSequence: null,
    endSequence: null,
    minutes: null,
    overs: 2
  };
}

test('selects a bounded shared tool and produces concise recap narration', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ functionCall: { name: 'LAST_N_OVERS', args: { overs: 2 } } }],
                role: 'model'
              },
              finishReason: 'STOP'
            }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '### Recent pressure\n\nThe last two completed overs added 12 runs.\n\n* One boundary changed the tempo.\n* No wicket fell.'
                }
              ],
              role: 'model'
            },
            finishReason: 'STOP'
          }
        ]
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  try {
    Object.assign(config.gemini, {
      apiKey: 'test-key',
      model: 'test-model',
      timeoutMs: 1000,
      maxOutputTokens: 100
    });
    const tool = await selectTool({
      query: 'Summarize the last 2 overs',
      players: [{ id: 'player-1', displayName: 'Player One' }],
      sessionIdProvided: false
    });
    const recap = await narrateRecap({
      query: 'Summarize the last 2 overs',
      evidence: { totals: { runs: 12 } }
    });

    assert.equal(tool.tool, 'LAST_N_OVERS');
    assert.equal(tool.overs, 2);
    assert.ok(typeof recap === 'string');
    assert.ok(recap.includes('Recent pressure'));
    assert.equal(calls.length, 2);
    assert.equal(
      calls[0].url,
      'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent'
    );
    const apiKeyHeader = calls[0].options.headers?.get
      ? calls[0].options.headers.get('x-goog-api-key')
      : calls[0].options.headers['x-goog-api-key'];
    assert.equal(apiKeyHeader, 'test-key');

    const selectionRequest = JSON.parse(calls[0].options.body);
    assert.ok(Array.isArray(selectionRequest.tools[0].functionDeclarations));
    assert.equal(selectionRequest.toolConfig.functionCallingConfig.mode, 'ANY');
    assert.ok(selectionRequest.systemInstruction.parts[0].text.includes('router'));

    const narrationRequest = JSON.parse(calls[1].options.body);
    assert.ok(
      narrationRequest.systemInstruction.parts[0].text.includes('summary') ||
        narrationRequest.systemInstruction.parts[0].text.includes('recap')
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects shared query calls when Gemini is not configured', async () => {
  config.gemini.apiKey = '';
  await assert.rejects(
    () => selectTool({ query: 'Analyze first over', players: [], sessionIdProvided: false }),
    AiUnavailableError
  );
});
