import { sessionRequestSchema } from '../schemas/recapSchemas.js';
import { handleValidationError } from '../utils/validation.js';

export function createRecapController(recapService) {
  return {
    async join(req, res, next) {
      try {
        res.status(201).json({
          session: await recapService.join({ matchId: req.params.matchId, viewer: req.viewer })
        });
      } catch (error) {
        next(error);
      }
    },

    async leave(req, res, next) {
      try {
        const { sessionId } = sessionRequestSchema.parse(req.body);
        await recapService.leave({ matchId: req.params.matchId, sessionId, viewer: req.viewer });
        res.status(204).end();
      } catch (error) {
        next(handleValidationError(error, 'Invalid match session request.'));
      }
    }
  };
}
