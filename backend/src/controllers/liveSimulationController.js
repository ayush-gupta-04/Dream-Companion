import { startForMatch } from '../replay/liveReplayManager.js';

export async function start(req, res, next) {
  try {
    const simulation = await startForMatch(req.params.matchId);
    res.status(simulation.status === 'started' ? 202 : 200).json({ simulation });
  } catch (error) {
    next(error);
  }
}
