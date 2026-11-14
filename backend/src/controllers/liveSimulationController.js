export function createLiveSimulationController(liveReplayManager) {
  return {
    async start(req, res, next) {
      try {
        const simulation = await liveReplayManager.startForMatch(req.params.matchId);
        res.status(simulation.status === 'started' ? 202 : 200).json({ simulation });
      } catch (error) {
        next(error);
      }
    }
  };
}
