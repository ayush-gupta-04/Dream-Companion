import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOpenAiRecapClient } from '../../src/modules/ai/openAiRecapClient.js';

test('sends a bounded structured recap tool-selection request through the Responses API', async () => {
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
                text: JSON.stringify({ tool: 'LAST_N_OVERS', minutes: null, overs: 2 })
              }
            ]
          }
        ]
      })
    };
  };

  try {
    const client = createOpenAiRecapClient({
      apiKey: 'test-key',
      model: 'test-model',
      timeoutMs: 1000,
      maxOutputTokens: 100
    });
    const intent = await client.resolveIntent({
      query: 'Summarize the last 2 overs',
      sessionId: undefined
    });

    assert.deepEqual(intent, { tool: 'LAST_N_OVERS', minutes: null, overs: 2 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.text.format.name, 'catch_me_up_tool_selection');
    assert.equal(body.store, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns no recap client when OpenAI is not configured', () => {
  assert.equal(createOpenAiRecapClient({ apiKey: '' }), null);
});
