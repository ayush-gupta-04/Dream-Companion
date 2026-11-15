import { queryMatch as runMatchQuery } from '../modules/ai/matchQueryService.js';
import { matchQueryRequestSchema } from '../schemas/matchQuerySchemas.js';
import { handleValidationError } from '../utils/validation.js';

export async function queryMatch(req, res, next) {
  try {
    const request = matchQueryRequestSchema.parse(req.body);
    res.json(
      await runMatchQuery({ matchId: req.params.matchId, request, viewer: req.viewer })
    );
  } catch (error) {
    next(handleValidationError(error, 'Invalid match query request.'));
  }
}
