import { config } from '../../config/index.js';
import { prisma } from '../../db/prisma.js';
import { analysisToolTypes } from '../../schemas/matchQuerySchemas.js';
import { recapWindowTypes } from '../../schemas/recapSchemas.js';
import { executeRecap } from '../summaries/recapService.js';
import { executeAnalysis } from './askMatchService.js';
import { AiUnavailableError } from './geminiClient.js';
import { selectTool } from './geminiMatchQueryClient.js';

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
    answer: result.answer ?? '',
    evidence: result.facts,
    references: result.references ?? result.facts?.references ?? [],
    window: null,
    limitations: result.limitations ?? []
  };
}

function recapResult(result) {
  return {
    kind: 'RECAP',
    tool: result.tool,
    answer: result.recap ?? null,
    evidence: result.evidence,
    references: result.references ?? result.evidence?.references ?? [],
    window: result.window,
    limitations: result.limitations ?? []
  };
}

async function requireMatch(matchId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true }
  });
  if (!match) throw new MatchQueryNotFoundError('Match not found.');
  return match;
}

/**
 * Main AI match assistant entrypoint.
 * Routes a natural-language query to an analysis tool or recap window,
 * fetches deterministic facts, and returns a grounded narration.
 */
export async function queryMatch({ matchId, request, viewer }) {
  if (!config.gemini.apiKey) throw new AiUnavailableError();

  const match = await requireMatch(matchId);
  const players = await prisma.player.findMany({
    where: { matchAppearances: { some: { matchId } } },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' }
  });

  const tool = await selectTool({
    query: request.query,
    players,
    sessionIdProvided: Boolean(request.sessionId)
  });

  if (analysisToolTypes.includes(tool.tool)) {
    return analysisResult(await executeAnalysis({ matchId, query: request.query, tool }));
  }

  if (recapWindowTypes.includes(tool.tool)) {
    return recapResult(await executeRecap({ matchId, match, request, tool, viewer }));
  }

  return unsupportedResult();
}
