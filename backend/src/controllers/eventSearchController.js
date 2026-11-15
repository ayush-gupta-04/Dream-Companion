import { searchMatchEvents } from '../modules/timeline/eventSearchService.js';
import { eventSearchQuerySchema } from '../schemas/timelineSchemas.js';
import { handleValidationError } from '../utils/validation.js';

export async function search(req, res, next) {
  try {
    const query = eventSearchQuerySchema.parse(req.query);
    res.json(
      await searchMatchEvents({
        matchId: req.params.matchId,
        ...query,
        inningsNumber: query.innings
      })
    );
  } catch (error) {
    next(handleValidationError(error, 'Invalid event search request.'));
  }
}
