import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import request from 'supertest';
import { config } from '../src/config/index.js';
import { requireAuthenticated as actualRequireAuthenticated } from '../src/auth/clerkAuth.js';

mock.module('../src/auth/clerkAuth.js', {
  exports: {
    initializeAuth: (_req, _res, next) => next(),
    requireAuthenticated: (_req, res) =>
      res.status(401).json({ status: 'error', message: 'Authentication is required.' }),
    authenticateSocket: async () => { throw new Error('Authentication is required.'); }
  }
});
const { default: app } = await import('../src/app.js');

test('keeps health public while rejecting unauthenticated API requests', async () => {

  const health = await request(app).get('/health');
  const apiHealth = await request(app).get('/api/health');
  const staticImage = await request(app).get('/match-card-images/img1.jpg');
  const protectedRoute = await request(app).get('/api/matches/live');
  const unauthenticatedApi404 = await request(app).get('/api/unknown-endpoint');
  const public404 = await request(app).get('/unknown-public-endpoint');

  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal(apiHealth.status, 200);
  assert.equal(apiHealth.body.status, 'ok');
  assert.equal(staticImage.status, 200);
  assert.equal(protectedRoute.status, 401);
  assert.equal(protectedRoute.body.message, 'Authentication is required.');
  assert.equal(unauthenticatedApi404.status, 401);
  assert.equal(unauthenticatedApi404.body.message, 'Authentication is required.');
  assert.equal(public404.status, 404);
  assert.deepEqual(public404.body, {
    status: 'error',
    message: 'Cannot GET /unknown-public-endpoint'
  });
});

test('keeps live-simulation activation behind normal authentication', async () => {

  const response = await request(app).post('/api/matches/live-match/live-simulation');

  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Authentication is required.');
});

test('fails closed outside tests when Clerk is not configured', () => {
  const originalEnv = config.nodeEnv;
  const originalSecretKey = config.clerk.secretKey;
  config.nodeEnv = 'development';
  config.clerk.secretKey = '';
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

  try {
    actualRequireAuthenticated({}, response);
  } finally {
    config.nodeEnv = originalEnv;
    config.clerk.secretKey = originalSecretKey;
  }

  assert.equal(result.statusCode, 503);
  assert.equal(result.payload.message, 'Authentication is not configured.');
});
