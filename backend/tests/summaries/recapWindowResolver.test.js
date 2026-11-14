import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRecapWindow } from '../../src/modules/summaries/recapWindowResolver.js';

function delivery({ sequence, over, inningsNumber = 1, wicket = false, occurredAt = null }) {
  return {
    id: `delivery-${inningsNumber}-${sequence}`,
    inningsId: `innings-${inningsNumber}`,
    deliverySequence: sequence,
    displayOver: over,
    displayBallLabel: `source-${sequence}`,
    occurredAt,
    innings: { inningsNumber },
    wickets: wicket ? [{ countsAsWicket: true }] : []
  };
}

test('returns the just-ended over without assuming six delivery records', () => {
  const deliveries = [
    delivery({ sequence: 1, over: 0 }),
    delivery({ sequence: 2, over: 0 }),
    delivery({ sequence: 3, over: 0 }),
    delivery({ sequence: 4, over: 1 }),
    delivery({ sequence: 5, over: 1 })
  ];

  const window = resolveRecapWindow({
    matchStatus: 'LIVE',
    deliveries,
    request: { window: 'LAST_OVER' }
  });

  assert.equal(window.anchor.deliverySequence, 3);
  assert.deepEqual(
    window.deliveries.map((entry) => entry.deliverySequence),
    [1, 2, 3]
  );
  assert.deepEqual(window.overRange, {
    inningsNumber: 1,
    startOverNumber: 0,
    endOverNumber: 0,
    requestedOvers: 1,
    completedOversReturned: 1
  });
});

test('returns the requested number of completed overs from the current innings only', () => {
  const deliveries = [
    delivery({ sequence: 1, over: 0, inningsNumber: 1 }),
    delivery({ sequence: 2, over: 1, inningsNumber: 1 }),
    delivery({ sequence: 1, over: 0, inningsNumber: 2 }),
    delivery({ sequence: 2, over: 0, inningsNumber: 2 }),
    delivery({ sequence: 3, over: 1, inningsNumber: 2 })
  ];

  const window = resolveRecapWindow({
    matchStatus: 'LIVE',
    deliveries,
    request: { window: 'LAST_N_OVERS', overs: 2 }
  });

  assert.deepEqual(
    window.deliveries.map((entry) => [entry.innings.inningsNumber, entry.deliverySequence]),
    [
      [2, 1],
      [2, 2]
    ]
  );
  assert.equal(window.overRange.completedOversReturned, 1);
  assert.deepEqual(window.limitations, [
    'Only 1 completed over(s) are available in the current innings.'
  ]);
});

test('treats the final over as complete after a completed innings', () => {
  const window = resolveRecapWindow({
    matchStatus: 'COMPLETE',
    deliveries: [delivery({ sequence: 1, over: 0 }), delivery({ sequence: 2, over: 1 })],
    request: { window: 'LAST_N_OVERS', overs: 2 }
  });

  assert.deepEqual(
    window.deliveries.map((entry) => entry.deliverySequence),
    [1, 2]
  );
  assert.equal(window.overRange.completedOversReturned, 2);
});

test('returns an empty last-over window before any over has completed', () => {
  const window = resolveRecapWindow({
    matchStatus: 'LIVE',
    deliveries: [delivery({ sequence: 1, over: 0 })],
    request: { window: 'LAST_OVER' }
  });

  assert.equal(window.deliveryRange.deliveryCount, 0);
  assert.deepEqual(window.limitations, [
    'No completed over is available in the current innings yet.'
  ]);
});

test('returns an explicit unavailable result when timestamps cannot establish a time window', () => {
  const window = resolveRecapWindow({
    matchStatus: 'LIVE',
    deliveries: [delivery({ sequence: 1, over: 0 })],
    request: { window: 'LAST_N_MINUTES', minutes: 10 }
  });

  assert.equal(window.availability, 'UNAVAILABLE');
  assert.equal(window.timestampQuality, 'UNAVAILABLE');
});

test('resolves a session marker across innings using stable ordering fields', () => {
  const deliveries = [
    delivery({ sequence: 1, over: 0, inningsNumber: 1 }),
    delivery({ sequence: 2, over: 0, inningsNumber: 1 }),
    delivery({ sequence: 1, over: 0, inningsNumber: 2 })
  ];
  const window = resolveRecapWindow({
    matchStatus: 'LIVE',
    deliveries,
    request: { window: 'SINCE_SESSION_JOIN' },
    session: {
      joinedInningsNumber: 1,
      joinedDeliverySequence: 2,
      joinedAt: new Date('2026-11-14T10:00:00.000Z')
    }
  });

  assert.deepEqual(
    window.deliveries.map((entry) => [entry.innings.inningsNumber, entry.deliverySequence]),
    [[2, 1]]
  );
});
