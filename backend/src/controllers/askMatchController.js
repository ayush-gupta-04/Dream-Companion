import { askMatchRequestSchema } from '../schemas/askMatchSchemas.js';
import { handleValidationError } from '../utils/validation.js';

export function createAskMatchController(askMatchService) {
  return async function askMatch(req, res, next) {
    try {
      const { question } = askMatchRequestSchema.parse(req.body);
      const result = await askMatchService.ask({ matchId: req.params.matchId, question });
      res.status(200).json(result);
    } catch (error) {
      next(handleValidationError(error, 'Invalid Ask the Match request.'));
    }
  };
}
