import { list } from '../modules/timeline/timelineService.js';
import { timelineQuerySchema } from '../schemas/timelineSchemas.js';
import { handleValidationError } from '../utils/validation.js';

export async function listTimeline(req, res, next) {
  try {
    const query = timelineQuerySchema.parse(req.query);
    res.json(
      await list({
        matchId: req.params.matchId,
        ...query,
        inningsNumber: query.innings
      })
    );
  } catch (error) {
    next(handleValidationError(error, 'Invalid timeline request.'));
  }
}
