import {
  analyzeOver,
  analyzePlayer,
  compareOvers
} from '../modules/analytics/matchAnalyticsService.js';
import {
  overAnalysisParamsSchema,
  overAnalysisQuerySchema,
  overComparisonQuerySchema
} from '../schemas/analyticsSchemas.js';
import { handleValidationError } from '../utils/validation.js';

export function createAnalyticsController(prisma) {
  return {
    async over(req, res, next) {
      try {
        const { innings: inningsNumber } = overAnalysisQuerySchema.parse(req.query);
        const { overNumber } = overAnalysisParamsSchema.parse(req.params);
        res.json({
          analysis: await analyzeOver(prisma, {
            matchId: req.params.matchId,
            inningsNumber,
            overNumber
          })
        });
      } catch (error) {
        next(handleValidationError(error, 'Invalid analytics request.'));
      }
    },

    async comparison(req, res, next) {
      try {
        const { innings: inningsNumber, over1, over2 } = overComparisonQuerySchema.parse(req.query);
        res.json({
          analysis: await compareOvers(prisma, {
            matchId: req.params.matchId,
            inningsNumber,
            over1,
            over2
          })
        });
      } catch (error) {
        next(handleValidationError(error, 'Invalid analytics request.'));
      }
    },

    async player(req, res, next) {
      try {
        res.json({
          analysis: await analyzePlayer(prisma, {
            matchId: req.params.matchId,
            playerId: req.params.playerId
          })
        });
      } catch (error) {
        next(handleValidationError(error, 'Invalid analytics request.'));
      }
    }
  };
}
