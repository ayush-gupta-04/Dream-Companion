import { redisClient } from '../../../db/redis.js';

const stateKey = (matchId) => `match:${matchId}:state`;

export async function getOrBuild(matchId, build) {
  try {
    const cached = await redisClient.get(stateKey(matchId));
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn(
      '[MatchStateCache] Redis read failed; rebuilding from PostgreSQL.',
      error.message
    );
  }

  const state = await build();
  if (state) {
    await set(matchId, state);
  }
  return state;
}

export async function set(matchId, state) {
  try {
    await redisClient.set(stateKey(matchId), JSON.stringify(state), { EX: 86_400 });
  } catch (error) {
    console.warn(
      '[MatchStateCache] Redis write failed; PostgreSQL remains authoritative.',
      error.message
    );
  }
}

export async function clear(matchId) {
  try {
    if (matchId && typeof redisClient.del === 'function') {
      await redisClient.del(stateKey(matchId));
    } else if (typeof redisClient.flushDb === 'function') {
      await redisClient.flushDb();
    }
  } catch (error) {
    console.warn('[MatchStateCache] Redis clear failed:', error.message);
  }
}
