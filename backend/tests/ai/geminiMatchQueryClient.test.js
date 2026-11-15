import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeminiMatchQueryClient } from '../../src/modules/ai/geminiMatchQueryClient.js';

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
    const response =
      calls.length === 1
        ? toolSelection()
        : {
            headline: 'Recent pressure',
            summary: 'The last two completed overs added 12 runs.',
            bullets: ['One boundary changed the tempo.', 'No wicket fell.']
          };
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: JSON.stringify(response) }], role: 'model' },
            finishReason: 'STOP'
          }
        ]
      })
    };
  };

  try {
    const client = createGeminiMatchQueryClient({
      apiKey: 'test-key',
      model: 'test-model',
      timeoutMs: 1000,
      maxOutputTokens: 100
    });
    const tool = await client.selectTool({
      query: 'Summarize the last 2 overs',
      players: [{ id: 'player-1', displayName: 'Player One' }],
      sessionIdProvided: false
    });
    const recap = await client.narrateRecap({
      query: 'Summarize the last 2 overs',
      evidence: { totals: { runs: 12 } }
    });

    assert.equal(tool.tool, 'LAST_N_OVERS');
    assert.equal(tool.overs, 2);
    assert.equal(recap.headline, 'Recent pressure');
    assert.equal(calls.length, 2);
    assert.equal(
      calls[0].url,
      'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent'
    );
    assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-key');

    const selectionRequest = JSON.parse(calls[0].options.body);
    assert.equal(selectionRequest.generationConfig.responseMimeType, 'application/json');
    assert.equal(selectionRequest.generationConfig.responseSchema.type, 'OBJECT');
    assert.ok(selectionRequest.systemInstruction.parts[0].text.includes('Select exactly one'));

    const narrationRequest = JSON.parse(calls[1].options.body);
    assert.ok(
      narrationRequest.systemInstruction.parts[0].text.includes('four to six') ||
        narrationRequest.systemInstruction.parts[0].text.includes('three to five')
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns no shared query client when Gemini is not configured', () => {
  assert.equal(createGeminiMatchQueryClient({ apiKey: '' }), null);
  assert.equal(createGeminiMatchQueryClient(null), null);
});
