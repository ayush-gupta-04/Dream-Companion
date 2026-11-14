import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { AiUnavailableError, createGeminiClient } from '../../src/modules/ai/geminiClient.js';

test('createGeminiClient returns null when apiKey is missing', () => {
  assert.equal(createGeminiClient({ apiKey: '' }), null);
  assert.equal(createGeminiClient(null), null);
});

test('generateStructured passes Gemini 3 thinkingLevel when configured', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ ok: true }) }] } }]
      })
    };
  };

  try {
    const client = createGeminiClient({
      apiKey: 'test-key',
      model: 'gemini-3.5-flash',
      thinkingLevel: 'MINIMAL',
      timeoutMs: 5000,
      maxOutputTokens: 2000
    });

    const result = await client.generateStructured({
      prompt: 'hello',
      schema: z.object({ ok: z.boolean() })
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    const body = JSON.parse(calls[0].options.body);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'MINIMAL' });
    assert.equal(body.generationConfig.maxOutputTokens, 2000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateStructured supports thinkingLevel for flash-lite models', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ ok: true }) }] } }]
      })
    };
  };

  try {
    const client = createGeminiClient({
      apiKey: 'test-key',
      model: 'gemini-3.5-flash-lite',
      thinkingLevel: 'MINIMAL',
      timeoutMs: 5000,
      maxOutputTokens: 1000
    });

    const result = await client.generateStructured({
      prompt: 'hello',
      schema: z.object({ ok: z.boolean() })
    });

    assert.deepEqual(result, { ok: true });
    const body = JSON.parse(calls[0].options.body);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'MINIMAL' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateStructured handles request timeouts gracefully', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    throw err;
  };

  try {
    const client = createGeminiClient({
      apiKey: 'test-key',
      model: 'gemini-3.5-flash',
      timeoutMs: 100
    });

    await assert.rejects(
      () =>
        client.generateStructured({
          prompt: 'hello',
          schema: z.object({ ok: z.boolean() })
        }),
      (err) => {
        assert.ok(err instanceof AiUnavailableError);
        assert.equal(err.message, 'The AI provider request timed out.');
        assert.equal(err.statusCode, 503);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateStructured throws AiUnavailableError when response fails schema validation', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ invalid: 'field' }) }] } }]
    })
  });

  try {
    const client = createGeminiClient({
      apiKey: 'test-key',
      model: 'gemini-3.5-flash'
    });

    await assert.rejects(
      () =>
        client.generateStructured({
          prompt: 'hello',
          schema: z.object({ expectedField: z.string() })
        }),
      (err) => {
        assert.ok(err instanceof AiUnavailableError);
        assert.equal(err.message, 'The AI response could not be validated.');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateStructured reports the safe Gemini error status', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } })
  });

  try {
    const client = createGeminiClient({ apiKey: 'test-key', model: 'gemini-3.5-flash' });

    await assert.rejects(
      () => client.generateStructured({ prompt: 'hello', schema: z.object({ ok: z.boolean() }) }),
      (err) => {
        assert.ok(err instanceof AiUnavailableError);
        assert.equal(err.message, 'The AI provider rejected this request (INVALID_ARGUMENT).');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
