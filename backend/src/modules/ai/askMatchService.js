import { analyzeOver, analyzePlayer, compareOvers } from '../analytics/matchAnalyticsService.js';
import { searchMatchEvents } from '../timeline/eventSearchService.js';
import { AiUnavailableError } from './geminiClient.js';

const ASK_EVENT_SEARCH_LIMIT = 25;

export class AskMatchValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AskMatchValidationError';
    this.statusCode = 422;
  }
}

export function createAskMatchService({
  prisma,
  narrate,
  tools = { analyzeOver, analyzePlayer, compareOvers, searchMatchEvents }
}) {
  return {
    async execute({ matchId, query, tool }) {
      if (!narrate) throw new AiUnavailableError();
      let facts;
      let limitations = [];
      if (tool.tool === 'OVER_ANALYSIS') {
        if (tool.overNumber !== null && !tool.inningsNumber) {
          throw new AskMatchValidationError(
            'Specify an innings and over number for over analysis.'
          );
        }
        facts = await tools.analyzeOver(prisma, {
          matchId,
          inningsNumber: tool.inningsNumber ?? null,
          overNumber: tool.overNumber ?? null
        });
      } else if (tool.tool === 'PLAYER_ANALYSIS') {
        if (!tool.playerId)
          throw new AskMatchValidationError('Specify a player for player analysis.');
        facts = await tools.analyzePlayer(prisma, { matchId, playerId: tool.playerId });
      } else if (tool.tool === 'OVER_COMPARISON') {
        if (!tool.inningsNumber || tool.comparisonOver1 === null || tool.comparisonOver2 === null) {
          throw new AskMatchValidationError(
            'Specify an innings and two over numbers for over comparison.'
          );
        }
        if (tool.comparisonOver1 === tool.comparisonOver2) {
          throw new AskMatchValidationError('Choose two different overs to compare.');
        }
        facts = await tools.compareOvers(prisma, {
          matchId,
          inningsNumber: tool.inningsNumber,
          over1: tool.comparisonOver1,
          over2: tool.comparisonOver2
        });
      } else if (tool.tool === 'EVENT_SEARCH') {
        if ((tool.startSequence || tool.endSequence) && !tool.inningsNumber) {
          throw new AskMatchValidationError(
            'Specify an innings when searching by delivery sequence.'
          );
        }
        facts = await tools.searchMatchEvents(prisma, {
          matchId,
          inningsNumber: tool.inningsNumber ?? undefined,
          types: tool.eventTypes?.length ? tool.eventTypes : undefined,
          playerId: tool.playerId ?? undefined,
          startSequence: tool.startSequence ?? undefined,
          endSequence: tool.endSequence ?? undefined,
          minimumImportance: tool.minimumImportance ?? undefined,
          limit: ASK_EVENT_SEARCH_LIMIT
        });
        if (facts.nextCursor) {
          limitations = [
            `Only the first ${ASK_EVENT_SEARCH_LIMIT} matching events were used for this answer. Use event search pagination for the remaining results.`
          ];
        }
      } else {
        throw new AskMatchValidationError('Unsupported analysis tool.');
      }

      const narration = await narrate({ query, facts });
      return {
        tool: tool.tool,
        answer: { ...narration, factReferences: facts.references },
        facts,
        limitations
      };
    }
  };
}
