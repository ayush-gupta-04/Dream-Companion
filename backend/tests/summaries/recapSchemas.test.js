import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recapRequestSchema } from '../../src/schemas/recapSchemas.js';

test('accepts a natural-language recap query and rejects the retired structured window input', () => {
  const request = recapRequestSchema.parse({ query: 'Summarize the last 3 overs' });

  assert.equal(request.query, 'Summarize the last 3 overs');
  assert.equal(request.detail, 'QUICK');
  assert.equal(recapRequestSchema.safeParse({ window: 'LAST_N_OVERS', overs: 3 }).success, false);
  assert.equal(recapRequestSchema.safeParse({ query: 'ok' }).success, false);
});
