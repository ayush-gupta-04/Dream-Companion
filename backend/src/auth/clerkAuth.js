import { verifyToken } from '@clerk/backend';
import { clerkMiddleware, getAuth } from '@clerk/express';

function unauthorized(res) {
  res.status(401).json({ status: 'error', message: 'Authentication is required.' });
}

function unavailable(res) {
  res.status(503).json({ status: 'error', message: 'Authentication is not configured.' });
}

function assignViewer(req, { userId, sessionId = null }) {
  req.viewer = { userId, sessionId };
}

function configuredSocketAuthenticator(clerk) {
  if (!clerk.secretKey) {
    return async () => {
      throw new Error('Authentication is not configured.');
    };
  }

  return async (token) => {
    if (!token || typeof token !== 'string') throw new Error('Authentication is required.');
    const claims = await verifyToken(token, {
      secretKey: clerk.secretKey,
      authorizedParties: clerk.authorizedParties
    });
    if (!claims?.sub) throw new Error('Authentication is required.');
    return { userId: claims.sub, sessionId: claims.sid ?? null };
  };
}

export function createTestAuth({ userId = 'user_test', sessionId = 'sess_test' } = {}) {
  const viewer = { userId, sessionId };

  return {
    initialize: (req, res, next) => next(),
    requireAuthenticated: (req, res, next) => {
      assignViewer(req, viewer);
      next();
    },
    authenticateSocket: async () => viewer
  };
}

export function createClerkAuth({ clerk, nodeEnv }) {
  if (nodeEnv === 'test') return createTestAuth();

  if (!clerk.secretKey) {
    return {
      initialize: (req, res, next) => next(),
      requireAuthenticated: (req, res) => unavailable(res),
      authenticateSocket: configuredSocketAuthenticator(clerk)
    };
  }

  const initialize = clerkMiddleware({
    publishableKey: clerk.publishableKey,
    secretKey: clerk.secretKey,
    authorizedParties: clerk.authorizedParties
  });

  function requireAuthenticated(req, res, next) {
    const { isAuthenticated, userId, sessionId } = getAuth(req);
    if (!isAuthenticated || !userId) return unauthorized(res);
    assignViewer(req, { userId, sessionId });
    next();
  }

  return {
    initialize,
    requireAuthenticated,
    authenticateSocket: configuredSocketAuthenticator(clerk)
  };
}
