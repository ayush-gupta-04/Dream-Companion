import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  matchQueryRequestSchema,
  matchQueryToolSchema
} from '../../src/schemas/matchQuerySchemas.js';

function emptyParameters() {
  return {
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
    overs: null
  };
}

test('accepts the shared query request and rejects retired detail input', () => {
  assert.equal(
    matchQueryRequestSchema.parse({ query: 'Summarize the last 3 overs' }).query,
    'Summarize the last 3 overs'
  );
  assert.equal(
    matchQueryRequestSchema.safeParse({ query: 'Summarize the match', detail: 'QUICK' }).success,
    false
  );
  assert.equal(matchQueryRequestSchema.safeParse({ query: 'ok' }).success, false);
});

test('requires bounded parameters for the selected tool', () => {
  assert.equal(
    matchQueryToolSchema.safeParse({
      tool: 'LAST_N_OVERS',
      ...emptyParameters(),
      overs: 2
    }).success,
    true
  );
  assert.equal(
    matchQueryToolSchema.safeParse({
      tool: 'LAST_N_OVERS',
      ...emptyParameters()
    }).success,
    false
  );
  assert.equal(
    matchQueryToolSchema.safeParse({
      tool: 'OVER_ANALYSIS',
      ...emptyParameters(),
      overNumber: 3
    }).success,
    false
  );
  assert.equal(
    matchQueryToolSchema.safeParse({
      tool: 'OVER_ANALYSIS',
      ...emptyParameters(),
      inningsNumber: 1
    }).success,
    false
  );
  assert.equal(
    matchQueryToolSchema.safeParse({
      tool: 'OVER_ANALYSIS',
      ...emptyParameters()
    }).success,
    true
  );
  assert.equal(
    matchQueryToolSchema.safeParse({
      tool: 'OVER_ANALYSIS',
      ...emptyParameters(),
      inningsNumber: 1,
      overNumber: 0
    }).success,
    true
  );
});
