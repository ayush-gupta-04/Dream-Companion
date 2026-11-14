import { timelineQuerySchema } from '../schemas/timelineSchemas.js';
import { handleValidationError } from '../utils/validation.js';

export function createTimelineController(timelineService) {
  return {
    async list(req, res, next) {
      try {
        const query = timelineQuerySchema.parse(req.query);
        res.json(
          await timelineService.list({
            matchId: req.params.matchId,
            ...query,
            inningsNumber: query.innings
          })
        );
      } catch (error) {
        next(handleValidationError(error, 'Invalid timeline request.'));
      }
    }
  };
}
