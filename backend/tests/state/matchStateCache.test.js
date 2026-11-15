import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';

const redisClient = {};
mock.module('../../src/db/redis.js', { exports: { redisClient } });
const stateCache = await import('../../src/modules/match-intelligence/state/matchStateCache.js');

function useRedis(methods) {
  for (const key of Object.keys(redisClient)) delete redisClient[key];
  Object.assign(redisClient, methods);
  return stateCache;
}

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

    const cache = useRedis(mockRedis);
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

    const cache = useRedis(mockRedis);
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

    const cache = useRedis(mockRedis);
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

    const cache = useRedis(mockRedis);
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

    const cache = useRedis(mockRedis);
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

    const cache = useRedis(mockRedis);
    await cache.clear();
    assert.equal(flushed, true);
  });

  test('handles missing or incomplete redis client safely without error', async () => {
    const cache = useRedis({});
    await assert.doesNotReject(async () => {
      await cache.clear('any');
      await cache.clear();
    });
  });
});
