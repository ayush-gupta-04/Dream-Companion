import { verifyToken } from '@clerk/backend';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { config } from '../config/index.js';

const testViewer = { userId: 'user_test', sessionId: 'sess_test' };

export const initializeAuth =
  config.nodeEnv !== 'test' && config.clerk.secretKey
    ? clerkMiddleware({
        publishableKey: config.clerk.publishableKey,
        secretKey: config.clerk.secretKey,
        authorizedParties: config.clerk.authorizedParties
      })
    : (_req, _res, next) => next();

export function requireAuthenticated(req, res, next) {
  if (config.nodeEnv === 'test') {
    req.viewer = testViewer;
    return next();
  }
  if (!config.clerk.secretKey) {
    return res.status(503).json({ status: 'error', message: 'Authentication is not configured.' });
  }
  const { isAuthenticated, userId, sessionId } = getAuth(req);
  if (!isAuthenticated || !userId) {
    return res.status(401).json({ status: 'error', message: 'Authentication is required.' });
  }
  req.viewer = { userId, sessionId };
  next();
}

export async function authenticateSocket(token) {
  if (config.nodeEnv === 'test') return testViewer;
  if (!config.clerk.secretKey) throw new Error('Authentication is not configured.');
  if (!token || typeof token !== 'string') throw new Error('Authentication is required.');
  const claims = await verifyToken(token, {
    secretKey: config.clerk.secretKey,
    authorizedParties: config.clerk.authorizedParties
  });
  if (!claims?.sub) throw new Error('Authentication is required.');
  return { userId: claims.sub, sessionId: claims.sid ?? null };
}
