import { recapRequestSchema, sessionRequestSchema } from '../schemas/recapSchemas.js';
import { handleValidationError } from '../utils/validation.js';

export function createRecapController(recapService) {
  return {
    async join(req, res, next) {
      try {
        res.status(201).json({ session: await recapService.join({ matchId: req.params.matchId }) });
      } catch (error) {
        next(error);
      }
    },

    async leave(req, res, next) {
      try {
        const { sessionId } = sessionRequestSchema.parse(req.body);
        await recapService.leave({ matchId: req.params.matchId, sessionId });
        res.status(204).end();
      } catch (error) {
        next(handleValidationError(error, 'Invalid match session request.'));
      }
    },

    async summarize(req, res, next) {
      try {
        const request = recapRequestSchema.parse(req.body);
        res.json(await recapService.summarize({ matchId: req.params.matchId, request }));
      } catch (error) {
        next(handleValidationError(error, 'Invalid Catch Me Up request.'));
      }
    }
  };
}
