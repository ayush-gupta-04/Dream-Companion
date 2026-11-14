import { matchQueryRequestSchema } from '../schemas/matchQuerySchemas.js';
import { handleValidationError } from '../utils/validation.js';

export function createMatchQueryController(matchQueryService) {
  return async function queryMatch(req, res, next) {
    try {
      const request = matchQueryRequestSchema.parse(req.body);
      res.json(
        await matchQueryService.query({ matchId: req.params.matchId, request, viewer: req.viewer })
      );
    } catch (error) {
      next(handleValidationError(error, 'Invalid match query request.'));
    }
  };
}
