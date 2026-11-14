import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOpenAiAskClient } from '../../src/modules/ai/openAiAskClient.js';

test('sends structured intent requests through the Responses API', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  intent: 'OVER_ANALYSIS',
                  inningsNumber: 1,
                  overNumber: 0,
                  comparisonOver1: null,
                  comparisonOver2: null,
                  playerId: null,
                  eventTypes: null,
                  minimumImportance: null,
                  startSequence: null,
                  endSequence: null
                })
              }
            ]
          }
        ]
      })
    };
  };

  try {
    const client = createOpenAiAskClient({
      apiKey: 'test-key',
      model: 'test-model',
      timeoutMs: 1000,
      maxOutputTokens: 100
    });
    const intent = await client.resolveIntent({
      question: 'Analyse the first over',
      players: [{ id: 'player-1', displayName: 'Player One' }]
    });

    assert.equal(intent.intent, 'OVER_ANALYSIS');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
    assert.equal(JSON.parse(calls[0].options.body).store, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns no client when OpenAI is not configured', () => {
  assert.equal(createOpenAiAskClient({ apiKey: '' }), null);
});
