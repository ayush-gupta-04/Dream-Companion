import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

describe('Health Check API', () => {
  test('GET /health returns 200 and ok status', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'live-cricket-copilot-api');
    assert.ok(res.body.timestamp);
  });

  test('GET /api/health returns 200 and ok status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  test('GET /non-existent-route returns 404', async () => {
    const res = await request(app).get('/non-existent-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.status, 'error');
  });
});

