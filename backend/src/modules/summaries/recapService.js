import { config } from '../../config/index.js';
import { prisma } from '../../db/prisma.js';
import { AiUnavailableError } from '../ai/geminiClient.js';
import { narrateRecap } from '../ai/geminiMatchQueryClient.js';
import { recapIntentSchema } from '../../schemas/recapSchemas.js';
import { buildRecapEvidence, recapNarrationContext } from './recapEvidenceService.js';
import { executeRecapTool } from './recapToolExecutor.js';

const deliveryInclude = {
  innings: { select: { inningsNumber: true } },
  batter: { select: { id: true, displayName: true } },
  bowler: { select: { id: true, displayName: true } },
  wickets: { include: { playerOut: { select: { id: true, displayName: true } } } }
};

export class RecapNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RecapNotFoundError';
    this.statusCode = 404;
  }
}

export class RecapValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RecapValidationError';
    this.statusCode = 422;
  }
}

function requireViewer(viewer) {
  if (!viewer?.userId) throw new RecapValidationError('Authentication is required.');
  return viewer;
}

function publicWindow(window, availability = window.availability) {
  return {
    type: window.type,
    availability,
    timestampQuality: window.timestampQuality,
    anchor: window.anchor,
    overRange: window.overRange,
    deliveryRange: window.deliveryRange
  };
}

function emptyResult(window) {
  const limitations =
    window.limitations.length > 0
      ? window.limitations
      : ['No deliveries are available for this recap window yet.'];
  return {
    window: publicWindow(window, 'EMPTY'),
    recap: null,
    evidence: null,
    limitations
  };
}

async function requireMatch(matchId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true }
  });
  if (!match) throw new RecapNotFoundError('Match not found.');
  return match;
}

async function requireActiveSession(matchId, sessionId, clerkUserId) {
  const session = await prisma.matchSession.findFirst({
    where: { id: sessionId, matchId, clerkUserId, leftAt: null },
    select: {
      id: true,
      joinedInningsNumber: true,
      joinedDeliverySequence: true,
      joinedAt: true
    }
  });
  if (!session) throw new RecapNotFoundError('Active match session not found.');
  return session;
}

export async function join({ matchId, viewer }) {
  const { userId, sessionId } = requireViewer(viewer);
  await requireMatch(matchId);
  const latestDelivery = await prisma.delivery.findFirst({
    where: { innings: { matchId } },
    select: {
      deliverySequence: true,
      innings: { select: { inningsNumber: true } }
    },
    orderBy: [{ innings: { inningsNumber: 'desc' } }, { deliverySequence: 'desc' }]
  });

  const session = await prisma.matchSession.create({
    data: {
      matchId,
      clerkUserId: userId,
      clerkSessionId: sessionId,
      joinedInningsNumber: latestDelivery?.innings.inningsNumber,
      joinedDeliverySequence: latestDelivery?.deliverySequence
    },
    select: {
      id: true,
      matchId: true,
      joinedInningsNumber: true,
      joinedDeliverySequence: true,
      joinedAt: true
    }
  });
  return {
    ...session,
    marker: {
      inningsNumber: session.joinedInningsNumber,
      deliverySequence: session.joinedDeliverySequence
    }
  };
}

export async function leave({ matchId, sessionId, viewer }) {
  const { userId } = requireViewer(viewer);
  const session = await prisma.matchSession.updateMany({
    where: { id: sessionId, matchId, clerkUserId: userId, leftAt: null },
    data: { leftAt: new Date() }
  });
  if (session.count === 0) throw new RecapNotFoundError('Active match session not found.');
}

export async function executeRecap({ matchId, match: suppliedMatch, request, tool, viewer }) {
  if (!config.gemini.apiKey) throw new AiUnavailableError();
  const match = suppliedMatch ?? (await requireMatch(matchId));
  const intent = recapIntentSchema.parse({
    tool: tool.tool,
    minutes: tool.minutes,
    overs: tool.overs
  });

  let session = null;
  if (intent.tool === 'SINCE_SESSION_JOIN') {
    if (!request.sessionId) {
      throw new RecapValidationError('Join the match before asking what you missed.');
    }

    const authenticatedViewer = requireViewer(viewer);
    session = await requireActiveSession(
      matchId,
      request.sessionId,
      authenticatedViewer.userId
    );
  }

  const deliveries = await prisma.delivery.findMany({
    where: { innings: { matchId } },
    include: deliveryInclude,
    orderBy: [{ innings: { inningsNumber: 'asc' } }, { deliverySequence: 'asc' }]
  });

  // Build the window .. according to the TOOL.
  const window = executeRecapTool({
    tool: intent,
    matchStatus: match.status,
    deliveries,
    session
  });

  if (window.availability === 'UNAVAILABLE') {
    return {
      tool: intent.tool,
      window: publicWindow(window),
      recap: null,
      evidence: null,
      limitations: window.limitations
    };
  }
  if (window.deliveries.length === 0) return { tool: intent.tool, ...emptyResult(window) };


  // Now i have a window, we will create evidence (aggregated result from the window).
  const evidence = buildRecapEvidence({
    matchId,
    deliveries: window.deliveries,
    window
  });

  // The LLM will narrate the evidence.
  const narration = await narrateRecap({
    query: request.query,
    evidence: recapNarrationContext(evidence)
  });
  return {
    tool: intent.tool,
    window: publicWindow(window),
    recap: { ...narration, factReferences: evidence.references },
    evidence,
    limitations: window.limitations
  };
}
