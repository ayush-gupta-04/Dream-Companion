import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redisClient } from '../../src/db/redis.js';
import * as cache from '../../src/modules/match-intelligence/state/matchStateCache.js';

test('persists and retrieves match state with live Redis server', async (t) => {
  try {
    await redisClient.connect();
  } catch {
    t.skip('Redis is unavailable');
    return;
  }

  const matchId = `integration-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const sampleState = {
    matchId,
    name: 'Live Redis Integration Match',
    status: 'LIVE',
    currentInnings: { inningsNumber: 1, totalRuns: 45, wickets: 2 },
    updatedAt: new Date().toISOString()
  };
  let buildCount = 0;
  const builder = async () => {
    buildCount += 1;
    return sampleState;
  };

  try {
    assert.deepEqual(await cache.getOrBuild(matchId, builder), sampleState);
    assert.equal(buildCount, 1);
    assert.deepEqual(JSON.parse(await redisClient.get(`match:${matchId}:state`)), sampleState);
    assert.deepEqual(await cache.getOrBuild(matchId, builder), sampleState);
    assert.equal(buildCount, 1);
    await cache.clear(matchId);
    assert.equal(await redisClient.get(`match:${matchId}:state`), null);
    assert.deepEqual(await cache.getOrBuild(matchId, builder), sampleState);
    assert.equal(buildCount, 2);
  } finally {
    await cache.clear(matchId);
    if (redisClient.isOpen) await redisClient.quit();
  }
});
