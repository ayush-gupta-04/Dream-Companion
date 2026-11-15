import { analyzeOver, analyzePlayer, compareOvers } from '../analytics/matchAnalyticsService.js';
import { searchMatchEvents } from '../timeline/eventSearchService.js';
import { narrateAnalysis } from './geminiMatchQueryClient.js';

const ASK_EVENT_SEARCH_LIMIT = 25;

export class AskMatchValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AskMatchValidationError';
    this.statusCode = 422;
  }
}

/**
 * Validates tool parameters and fetches deterministic facts from domain services.
 */
async function fetchAnalysisFacts(matchId, tool) {
  switch (tool.tool) {
    case 'OVER_ANALYSIS': {
      if (tool.overNumber !== null && !tool.inningsNumber) {
        throw new AskMatchValidationError(
          'Specify an innings and over number for over analysis.'
        );
      }
      const facts = await analyzeOver({
        matchId,
        inningsNumber: tool.inningsNumber ?? null,
        overNumber: tool.overNumber ?? null
      });
      return { facts, limitations: [] };
    }

    case 'PLAYER_ANALYSIS': {
      if (!tool.playerId) {
        throw new AskMatchValidationError('Specify a player for player analysis.');
      }
      const facts = await analyzePlayer({ matchId, playerId: tool.playerId });
      return { facts, limitations: [] };
    }

    case 'OVER_COMPARISON': {
      if (!tool.inningsNumber || tool.comparisonOver1 === null || tool.comparisonOver2 === null) {
        throw new AskMatchValidationError(
          'Specify an innings and two over numbers for over comparison.'
        );
      }
      if (tool.comparisonOver1 === tool.comparisonOver2) {
        throw new AskMatchValidationError('Choose two different overs to compare.');
      }
      const facts = await compareOvers({
        matchId,
        inningsNumber: tool.inningsNumber,
        over1: tool.comparisonOver1,
        over2: tool.comparisonOver2
      });
      return { facts, limitations: [] };
    }

    case 'EVENT_SEARCH': {
      if ((tool.startSequence || tool.endSequence) && !tool.inningsNumber) {
        throw new AskMatchValidationError(
          'Specify an innings when searching by delivery sequence.'
        );
      }
      const facts = await searchMatchEvents({
        matchId,
        inningsNumber: tool.inningsNumber ?? undefined,
        types: tool.eventTypes?.length ? tool.eventTypes : undefined,
        playerId: tool.playerId ?? undefined,
        startSequence: tool.startSequence ?? undefined,
        endSequence: tool.endSequence ?? undefined,
        minimumImportance: tool.minimumImportance ?? undefined,
        limit: ASK_EVENT_SEARCH_LIMIT
      });
      const limitations = facts.nextCursor
        ? [
            `Only the first ${ASK_EVENT_SEARCH_LIMIT} matching events were used for this answer. Use event search pagination for the remaining results.`
          ]
        : [];
      return { facts, limitations };
    }

    default:
      throw new AskMatchValidationError('Unsupported analysis tool.');
  }
}

/**
 * Executes a deterministic analysis query and narrates the findings via Gemini.
 */
export async function executeAnalysis({ matchId, query, tool }) {
  const { facts, limitations } = await fetchAnalysisFacts(matchId, tool);
  const narration = await narrateAnalysis({ query, facts });

  return {
    tool: tool.tool,
    answer: narration,
    facts,
    references: facts.references,
    limitations
  };
}
