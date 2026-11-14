import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MatchStateCache } from '../../src/modules/match-intelligence/state/matchStateCache.js';

describe('MatchStateCache Unit & Resilience Tests', () => {
  test('returns cached state on cache hit without invoking build()', async () => {
    let buildCalled = false;
    const mockRedis = {
      get: async (key) => {
        assert.equal(key, 'match:test-match-1:state');
        return JSON.stringify({ matchId: 'test-match-1', score: 42 });
      },
      set: async () => {
        throw new Error('Should not call set on hit');
      }
    };

    const cache = new MatchStateCache(mockRedis);
    const result = await cache.getOrBuild('test-match-1', async () => {
      buildCalled = true;
      return { matchId: 'test-match-1', score: 999 };
    });

    assert.equal(buildCalled, false);
    assert.deepEqual(result, { matchId: 'test-match-1', score: 42 });
  });

  test('calls build() on cache miss and writes state to Redis with TTL', async () => {
    let buildCalled = false;
    let setKey = null;
    let setValue = null;
    let setOpts = null;

    const mockRedis = {
      get: async () => null,
      set: async (key, value, opts) => {
        setKey = key;
        setValue = JSON.parse(value);
        setOpts = opts;
      }
    };

    const cache = new MatchStateCache(mockRedis);
    const result = await cache.getOrBuild('test-match-2', async () => {
      buildCalled = true;
      return { matchId: 'test-match-2', status: 'LIVE', totalRuns: 120 };
    });

    assert.equal(buildCalled, true);
    assert.deepEqual(result, { matchId: 'test-match-2', status: 'LIVE', totalRuns: 120 });
    assert.equal(setKey, 'match:test-match-2:state');
    assert.deepEqual(setValue, { matchId: 'test-match-2', status: 'LIVE', totalRuns: 120 });
    assert.deepEqual(setOpts, { EX: 86400 });
  });

  test('handles Redis read errors gracefully and falls back to build()', async () => {
    let buildCalled = false;
    const mockRedis = {
      get: async () => {
        throw new Error('Connection refused');
      },
      set: async () => {}
    };

    const cache = new MatchStateCache(mockRedis);
    const result = await cache.getOrBuild('test-match-3', async () => {
      buildCalled = true;
      return { matchId: 'test-match-3', source: 'PostgreSQL' };
    });

    assert.equal(buildCalled, true);
    assert.deepEqual(result, { matchId: 'test-match-3', source: 'PostgreSQL' });
  });

  test('handles Redis write errors gracefully without throwing', async () => {
    const mockRedis = {
      get: async () => null,
      set: async () => {
        throw new Error('OOM command not allowed');
      }
    };

    const cache = new MatchStateCache(mockRedis);
    const result = await cache.getOrBuild('test-match-4', async () => ({
      matchId: 'test-match-4',
      valid: true
    }));

    assert.deepEqual(result, { matchId: 'test-match-4', valid: true });
  });

  test('clear(matchId) deletes specific match cache key', async () => {
    let deletedKey = null;
    const mockRedis = {
      del: async (key) => {
        deletedKey = key;
      }
    };

    const cache = new MatchStateCache(mockRedis);
    await cache.clear('match-abc');
    assert.equal(deletedKey, 'match:match-abc:state');
  });

  test('clear() without matchId flushes database if flushDb exists', async () => {
    let flushed = false;
    const mockRedis = {
      flushDb: async () => {
        flushed = true;
      }
    };

    const cache = new MatchStateCache(mockRedis);
    await cache.clear();
    assert.equal(flushed, true);
  });

  test('handles missing or incomplete redis client safely without error', async () => {
    const cache = new MatchStateCache(null);
    await assert.doesNotReject(async () => {
      await cache.clear('any');
      await cache.clear();
    });
  });
});

describe('MatchStateCache Live Redis Integration', () => {
  test('persists and retrieves match state with live Redis server', async () => {
    const { createClient } = await import('redis');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisClient = createClient({
      url: redisUrl,
      socket: { reconnectStrategy: false }
    });

    try {
      await redisClient.connect();
    } catch {
      // If Redis cannot connect, skip live integration assertion
      return;
    }

    try {
      const matchId = `integration-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const cache = new MatchStateCache(redisClient);

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

      // 1. Initial call - Cache Miss (calls builder and sets Redis)
      const firstResult = await cache.getOrBuild(matchId, builder);
      assert.equal(buildCount, 1);
      assert.deepEqual(firstResult, sampleState);

      // 2. Verify key exists in live Redis directly
      const rawInRedis = await redisClient.get(`match:${matchId}:state`);
      assert.ok(rawInRedis, 'State should exist in live Redis');
      assert.deepEqual(JSON.parse(rawInRedis), sampleState);

      // 3. Second call - Cache Hit (must NOT call builder again)
      const secondResult = await cache.getOrBuild(matchId, builder);
      assert.equal(buildCount, 1, 'Builder should not be called on cache hit');
      assert.deepEqual(secondResult, sampleState);

      // 4. Invalidate cache via clear(matchId)
      await cache.clear(matchId);

      // 5. Verify key is removed from live Redis
      const afterClear = await redisClient.get(`match:${matchId}:state`);
      assert.equal(afterClear, null, 'Key must be deleted after cache.clear');

      // 6. Third call - Cache Miss again (calls builder)
      const thirdResult = await cache.getOrBuild(matchId, builder);
      assert.equal(buildCount, 2, 'Builder should be called again after cache clear');
      assert.deepEqual(thirdResult, sampleState);

      // Clean up key
      await cache.clear(matchId);
    } finally {
      if (redisClient.isOpen) {
        await redisClient.quit();
      }
    }
  });
});
