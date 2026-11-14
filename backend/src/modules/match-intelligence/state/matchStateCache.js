const stateKey = (matchId) => `match:${matchId}:state`;

export class MatchStateCache {
  constructor(redisClient) {
    this.redisClient = redisClient;
  }

  async getOrBuild(matchId, build) {
    try {
      const cached = await this.redisClient.get(stateKey(matchId));
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
      await this.set(matchId, state);
    }
    return state;
  }

  async set(matchId, state) {
    try {
      await this.redisClient.set(stateKey(matchId), JSON.stringify(state), { EX: 86_400 });
    } catch (error) {
      console.warn(
        '[MatchStateCache] Redis write failed; PostgreSQL remains authoritative.',
        error.message
      );
    }
  }
}
