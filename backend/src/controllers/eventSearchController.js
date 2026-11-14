import { eventSearchQuerySchema } from '../schemas/timelineSchemas.js';
import { handleValidationError } from '../utils/validation.js';

export function createEventSearchController(eventSearchService) {
  return {
    async search(req, res, next) {
      try {
        const query = eventSearchQuerySchema.parse(req.query);
        res.json(
          await eventSearchService.search({
            matchId: req.params.matchId,
            ...query,
            inningsNumber: query.innings
          })
        );
      } catch (error) {
        next(handleValidationError(error, 'Invalid event search request.'));
      }
    }
  };
}
