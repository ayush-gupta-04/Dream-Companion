import { analysisToolTypes, matchQueryToolSchema } from '../../schemas/matchQuerySchemas.js';
import { recapWindowTypes } from '../../schemas/recapSchemas.js';
import { AiUnavailableError } from './geminiClient.js';

export class MatchQueryNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MatchQueryNotFoundError';
    this.statusCode = 404;
  }
}

function unsupportedResult() {
  return {
    kind: 'UNSUPPORTED',
    tool: 'UNSUPPORTED',
    answer: null,
    evidence: null,
    references: [],
    window: null,
    limitations: [
      'This request is not yet supported. Try asking about an over, player, match events, or a short recap.'
    ]
  };
}

function analysisResult(result) {
  return {
    kind: 'ANALYSIS',
    tool: result.tool,
    answer: {
      headline: result.answer.headline,
      body: result.answer.analysis,
      bullets: []
    },
    evidence: result.facts,
    references: result.answer.factReferences,
    window: null,
    limitations: result.limitations
  };
}

function recapResult(result) {
  return {
    kind: 'RECAP',
    tool: result.tool,
    answer: result.recap
      ? {
          headline: result.recap.headline,
          body: result.recap.summary,
          bullets: result.recap.bullets
        }
      : null,
    evidence: result.evidence,
    references: result.recap?.factReferences ?? [],
    window: result.window,
    limitations: result.limitations
  };
}

async function requireMatch(prisma, matchId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true }
  });
  if (!match) throw new MatchQueryNotFoundError('Match not found.');
  return match;
}

export function createMatchQueryService({ prisma, aiClient, analysisService, recapService }) {
  return {
    async query({ matchId, request, viewer }) {
      if (!aiClient) throw new AiUnavailableError();

      const match = await requireMatch(prisma, matchId);
      const players = await prisma.player.findMany({
        where: { matchAppearances: { some: { matchId } } },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' }
      });
      const tool = matchQueryToolSchema.parse(
        await aiClient.selectTool({
          query: request.query,
          players,
          sessionIdProvided: Boolean(request.sessionId)
        })
      );

      if (tool.tool === 'UNSUPPORTED') return unsupportedResult();

      if (analysisToolTypes.includes(tool.tool)) {
        return analysisResult(
          await analysisService.execute({ matchId, query: request.query, tool })
        );
      }

      if (recapWindowTypes.includes(tool.tool)) {
        return recapResult(await recapService.execute({ matchId, match, request, tool, viewer }));
      }

      return unsupportedResult();
    }
  };
}
