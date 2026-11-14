import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createClerkAuth } from '../src/auth/clerkAuth.js';

function rejectedAuth() {
  return {
    initialize: (req, res, next) => next(),
    requireAuthenticated: (req, res) =>
      res.status(401).json({ status: 'error', message: 'Authentication is required.' }),
    authenticateSocket: async () => {
      throw new Error('Authentication is required.');
    }
  };
}

test('keeps health public while rejecting unauthenticated API requests', async () => {
  const app = createApp({ auth: rejectedAuth() });

  const health = await request(app).get('/health');
  const protectedRoute = await request(app).get('/api/matches/live');

  assert.equal(health.status, 200);
  assert.equal(protectedRoute.status, 401);
  assert.equal(protectedRoute.body.message, 'Authentication is required.');
});

test('keeps live-simulation activation behind normal authentication', async () => {
  const app = createApp({ auth: rejectedAuth() });

  const response = await request(app).post('/api/matches/live-match/live-simulation');

  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Authentication is required.');
});

test('fails closed outside tests when Clerk is not configured', () => {
  const auth = createClerkAuth({
    clerk: { secretKey: '', authorizedParties: [] },
    nodeEnv: 'development'
  });
  const result = {};
  const response = {
    status(statusCode) {
      result.statusCode = statusCode;
      return {
        json(payload) {
          result.payload = payload;
        }
      };
    }
  };

  auth.requireAuthenticated({}, response);

  assert.equal(result.statusCode, 503);
  assert.equal(result.payload.message, 'Authentication is not configured.');
});
