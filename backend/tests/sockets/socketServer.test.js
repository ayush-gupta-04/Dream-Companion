import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, mock, test } from 'node:test';
import { io as createClient } from 'socket.io-client';

let requireToken = false;
mock.module('../../src/auth/clerkAuth.js', {
  exports: {
    authenticateSocket: async (token) => {
      if (requireToken && token !== 'valid-token') throw new Error('Invalid token');
      return { userId: 'user_test', sessionId: 'sess_test' };
    }
  }
});
const {
  io,
  attachSocketServer,
  matchRoom,
  publishDeliveryUpdate,
  publishMatchStatus,
  publishTimelineChanges
} = await import('../../src/sockets/socketServer.js');

const httpServer = createServer();
let port;
before(async () => {
  attachSocketServer(httpServer);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  port = httpServer.address().port;
});
after(async () => {
  io.close();
  await new Promise((resolve) => httpServer.close(resolve));
});

test('publishes delivery and status updates to a match room in order', () => {
  const events = [];
  const to = mock.method(io, 'to', (room) => ({
    emit: (event, payload) => events.push({ room, event, payload })
  }));
  const delivery = {
    id: 'delivery-1',
    inningsId: 'innings-1',
    deliverySequence: 1,
    displayOver: 0,
    displayBallLabel: '0.1',
    batterRuns: 1,
    totalExtras: 0,
    totalRuns: 1,
    isLegalDelivery: true,
    occurredAt: null
  };
  const state = { matchId: 'match-1', status: 'LIVE' };

  publishDeliveryUpdate('match-1', 'created', delivery, state);
  publishMatchStatus('match-1', 'COMPLETE');
  to.mock.restore();

  assert.deepEqual(events, [
    {
      room: matchRoom('match-1'),
      event: 'delivery_added',
      payload: {
        id: 'delivery-1',
        inningsId: 'innings-1',
        deliverySequence: 1,
        display: { overNumber: 0, ballLabel: '0.1' },
        runs: { batter: 1, extras: 0, total: 1 },
        isLegalDelivery: true,
        occurredAt: null
      }
    },
    { room: matchRoom('match-1'), event: 'score_updated', payload: state },
    {
      room: matchRoom('match-1'),
      event: 'match_status_updated',
      payload: { matchId: 'match-1', status: 'COMPLETE' }
    }
  ]);
});

test('publishes timeline reconciliation changes to the matching room', () => {
  const events = [];
  const to = mock.method(io, 'to', (room) => ({
    emit: (event, payload) => events.push({ room, event, payload })
  }));
  const timelineEvent = { id: 'event-1', matchId: 'match-1', type: 'FOUR' };

  publishTimelineChanges({
    created: [timelineEvent],
    updated: [{ ...timelineEvent, title: 'Updated four' }],
    deleted: [timelineEvent]
  });
  to.mock.restore();

  assert.deepEqual(
    events.map((event) => event.event),
    ['timeline_event_created', 'timeline_event_updated', 'timeline_event_deleted']
  );
  assert.ok(events.every((event) => event.room === matchRoom('match-1')));
});

test('joins a requested match room and receives only that room events', async () => {
  const client = createClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });

  try {
    await new Promise((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    const joined = await new Promise((resolve) => client.emit('join_match', 'match-1', resolve));
    assert.deepEqual(joined, { ok: true });

    const received = new Promise((resolve) => client.once('match_status_updated', resolve));
    publishMatchStatus('match-2', 'LIVE');
    publishMatchStatus('match-1', 'COMPLETE');
    assert.deepEqual(await received, { matchId: 'match-1', status: 'COMPLETE' });
  } finally {
    client.close();
  }
});

test('rejects unauthenticated socket handshakes before joining a match room', async () => {
  requireToken = true;
  const anonymous = createClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  const authenticated = createClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    auth: { token: 'valid-token' }
  });

  try {
    const error = await new Promise((resolve) => anonymous.once('connect_error', resolve));
    assert.equal(error.message, 'Authentication is required.');

    await new Promise((resolve, reject) => {
      authenticated.once('connect', resolve);
      authenticated.once('connect_error', reject);
    });
    const joined = await new Promise((resolve) =>
      authenticated.emit('join_match', 'match-1', resolve)
    );
    assert.deepEqual(joined, { ok: true });
  } finally {
    anonymous.close();
    authenticated.close();
    requireToken = false;
  }
});
