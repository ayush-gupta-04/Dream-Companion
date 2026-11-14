import { AiUnavailableError } from '../ai/openAiResponsesClient.js';
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

async function requireMatch(prisma, matchId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true }
  });
  if (!match) throw new RecapNotFoundError('Match not found.');
  return match;
}

async function requireActiveSession(prisma, matchId, sessionId) {
  const session = await prisma.matchSession.findFirst({
    where: { id: sessionId, matchId, leftAt: null },
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

export function createRecapService({ prisma, aiClient, executeTool = executeRecapTool }) {
  return {
    async join({ matchId }) {
      await requireMatch(prisma, matchId);
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
    },

    async leave({ matchId, sessionId }) {
      const session = await prisma.matchSession.updateMany({
        where: { id: sessionId, matchId, leftAt: null },
        data: { leftAt: new Date() }
      });
      if (session.count === 0) throw new RecapNotFoundError('Active match session not found.');
    },

    async summarize({ matchId, request }) {
      if (!aiClient) throw new AiUnavailableError('Catch Me Up is not configured.');
      const match = await requireMatch(prisma, matchId);
      const intent = recapIntentSchema.parse(
        await aiClient.resolveIntent({
          query: request.query,
          sessionId: request.sessionId
        })
      );

      if (intent.tool === 'UNSUPPORTED') {
        return {
          intent: intent.tool,
          window: null,
          recap: null,
          evidence: null,
          limitations: [
            'This recap request is not yet supported. Try the last over, last N overs, last N minutes, what you missed, or the whole match.'
          ]
        };
      }

      if (intent.tool === 'SINCE_SESSION_JOIN' && !request.sessionId) {
        throw new RecapValidationError('Join the match before asking what you missed.');
      }
      const session =
        intent.tool === 'SINCE_SESSION_JOIN'
          ? await requireActiveSession(prisma, matchId, request.sessionId)
          : null;
      const deliveries = await prisma.delivery.findMany({
        where: { innings: { matchId } },
        include: deliveryInclude,
        orderBy: [{ innings: { inningsNumber: 'asc' } }, { deliverySequence: 'asc' }]
      });
      const window = executeTool({
        tool: intent,
        matchStatus: match.status,
        deliveries,
        session
      });

      if (window.availability === 'UNAVAILABLE') {
        return {
          intent: intent.tool,
          window: publicWindow(window),
          recap: null,
          evidence: null,
          limitations: window.limitations
        };
      }
      if (window.deliveries.length === 0) return { intent: intent.tool, ...emptyResult(window) };

      const evidence = buildRecapEvidence({
        matchId,
        deliveries: window.deliveries,
        window
      });
      const narration = await aiClient.narrate({
        query: request.query,
        detail: request.detail,
        evidence: recapNarrationContext(evidence)
      });
      return {
        intent: intent.tool,
        window: publicWindow(window),
        recap: { detail: request.detail, ...narration, factReferences: evidence.references },
        evidence,
        limitations: window.limitations
      };
    }
  };
}
