import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from '../../src/config/index.js';
import {
  AiUnavailableError,
  generateFunctionCall,
  generateText
} from '../../src/modules/ai/geminiClient.js';

function mockResponse(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('generateText rejects an unconfigured AI provider', async () => {
  config.gemini.apiKey = '';
  await assert.rejects(() => generateText({ prompt: 'hello' }), AiUnavailableError);
});

test('generateText passes Gemini 3 thinkingLevel when configured', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return mockResponse({
      candidates: [{ content: { parts: [{ text: 'ok response' }] } }]
    });
  };

  try {
    Object.assign(config.gemini, {
      apiKey: 'test-key',
      model: 'gemini-3.5-flash',
      thinkingLevel: 'MINIMAL',
      timeoutMs: 5000,
      maxOutputTokens: 2000
    });

    const result = await generateText({ prompt: 'hello' });

    assert.equal(result, 'ok response');
    assert.equal(calls.length, 1);
    const body = JSON.parse(calls[0].options.body);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'MINIMAL' });
    assert.equal(body.generationConfig.maxOutputTokens, 2000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateText supports thinkingLevel for flash-lite models', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return mockResponse({
      candidates: [{ content: { parts: [{ text: 'ok response' }] } }]
    });
  };

  try {
    Object.assign(config.gemini, {
      apiKey: 'test-key',
      model: 'gemini-3.5-flash-lite',
      thinkingLevel: 'MINIMAL',
      timeoutMs: 5000,
      maxOutputTokens: 1000
    });

    const result = await generateText({ prompt: 'hello' });

    assert.equal(result, 'ok response');
    const body = JSON.parse(calls[0].options.body);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'MINIMAL' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateText handles request timeouts gracefully', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    throw err;
  };

  try {
    Object.assign(config.gemini, {
      apiKey: 'test-key',
      model: 'gemini-3.5-flash',
      timeoutMs: 100
    });

    await assert.rejects(
      () => generateText({ prompt: 'hello' }),
      (err) => {
        assert.ok(err instanceof AiUnavailableError);
        assert.equal(err.statusCode, 503);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateText reports the safe Gemini error status', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    mockResponse({ error: { status: 'INVALID_ARGUMENT' } }, 400);

  try {
    Object.assign(config.gemini, { apiKey: 'test-key', model: 'gemini-3.5-flash' });

    await assert.rejects(
      () => generateText({ prompt: 'hello' }),
      (err) => {
        assert.ok(err instanceof AiUnavailableError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateText preserves rate-limit semantics', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    mockResponse({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429);

  try {
    Object.assign(config.gemini, { apiKey: 'test-key', model: 'gemini-3.5-flash' });
    await assert.rejects(
      () => generateText({ prompt: 'hello' }),
      (err) => {
        assert.ok(err instanceof AiUnavailableError);
        assert.equal(err.statusCode, 429);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateText combines text from all candidate parts', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    mockResponse({
      candidates: [
        {
          content: { parts: [{ text: 'A complete' }, { text: ' response.' }] },
          finishReason: 'STOP'
        }
      ]
    });

  try {
    Object.assign(config.gemini, { apiKey: 'test-key', model: 'gemini-3.5-flash' });
    const result = await generateText({ prompt: 'hello' });
    assert.equal(result, 'A complete response.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateFunctionCall finds a function call in any candidate part', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    mockResponse({
      candidates: [
        {
          content: {
            parts: [{ text: 'Routing request.' }, { functionCall: { name: 'LAST_OVER', args: {} } }]
          },
          finishReason: 'STOP'
        }
      ]
    });

  try {
    Object.assign(config.gemini, { apiKey: 'test-key', model: 'gemini-3.5-flash' });
    const result = await generateFunctionCall({ prompt: 'last over', tools: [] });
    assert.deepEqual(result, { name: 'LAST_OVER', args: {} });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
