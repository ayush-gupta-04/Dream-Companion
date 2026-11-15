import { join as joinSession, leave as leaveSession } from '../modules/summaries/recapService.js';
import { sessionRequestSchema } from '../schemas/recapSchemas.js';
import { handleValidationError } from '../utils/validation.js';

export async function join(req, res, next) {
  try {
    res.status(201).json({
      session: await joinSession({ matchId: req.params.matchId, viewer: req.viewer })
    });
  } catch (error) {
    next(error);
  }
}

export async function leave(req, res, next) {
  try {
    const { sessionId } = sessionRequestSchema.parse(req.body);
    await leaveSession({ matchId: req.params.matchId, sessionId, viewer: req.viewer });
    res.status(204).end();
  } catch (error) {
    next(handleValidationError(error, 'Invalid match session request.'));
  }
}
