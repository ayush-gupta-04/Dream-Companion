import { analyzeOver, analyzePlayer, compareOvers } from '../analytics/matchAnalyticsService.js';
import { searchMatchEvents } from '../timeline/eventSearchService.js';
import { AiUnavailableError } from './openAiResponsesClient.js';

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
  aiClient,
  tools = { analyzeOver, analyzePlayer, compareOvers, searchMatchEvents }
}) {
  return {
    async ask({ matchId, question }) {
      if (!aiClient) throw new AiUnavailableError();

      const players = await prisma.player.findMany({
        where: { matchAppearances: { some: { matchId } } },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' }
      });
      const intent = await aiClient.resolveIntent({ question, players });

      if (intent.intent === 'UNSUPPORTED') {
        return {
          intent: intent.intent,
          answer: null,
          facts: null,
          limitations: [
            'This question is not yet supported. Try asking about one over or one player.'
          ]
        };
      }

      let facts;
      let limitations = [];
      if (intent.intent === 'OVER_ANALYSIS') {
        if (!intent.inningsNumber || intent.overNumber === null) {
          throw new AskMatchValidationError(
            'Specify an innings and over number for over analysis.'
          );
        }
        facts = await tools.analyzeOver(prisma, {
          matchId,
          inningsNumber: intent.inningsNumber,
          overNumber: intent.overNumber
        });
      } else if (intent.intent === 'PLAYER_ANALYSIS') {
        if (!intent.playerId)
          throw new AskMatchValidationError('Specify a player for player analysis.');
        facts = await tools.analyzePlayer(prisma, { matchId, playerId: intent.playerId });
      } else if (intent.intent === 'OVER_COMPARISON') {
        if (
          !intent.inningsNumber ||
          intent.comparisonOver1 === null ||
          intent.comparisonOver2 === null
        ) {
          throw new AskMatchValidationError(
            'Specify an innings and two over numbers for over comparison.'
          );
        }
        if (intent.comparisonOver1 === intent.comparisonOver2) {
          throw new AskMatchValidationError('Choose two different overs to compare.');
        }
        facts = await tools.compareOvers(prisma, {
          matchId,
          inningsNumber: intent.inningsNumber,
          over1: intent.comparisonOver1,
          over2: intent.comparisonOver2
        });
      } else {
        if ((intent.startSequence || intent.endSequence) && !intent.inningsNumber) {
          throw new AskMatchValidationError(
            'Specify an innings when searching by delivery sequence.'
          );
        }
        facts = await tools.searchMatchEvents(prisma, {
          matchId,
          inningsNumber: intent.inningsNumber ?? undefined,
          types: intent.eventTypes?.length ? intent.eventTypes : undefined,
          playerId: intent.playerId ?? undefined,
          startSequence: intent.startSequence ?? undefined,
          endSequence: intent.endSequence ?? undefined,
          minimumImportance: intent.minimumImportance ?? undefined,
          limit: ASK_EVENT_SEARCH_LIMIT
        });
        if (facts.nextCursor) {
          limitations = [
            `Only the first ${ASK_EVENT_SEARCH_LIMIT} matching events were used for this answer. Use event search pagination for the remaining results.`
          ];
        }
      }

      const narration = await aiClient.narrate({ question, facts });
      return {
        intent: intent.intent,
        answer: { ...narration, factReferences: facts.references },
        facts,
        limitations
      };
    }
  };
}
