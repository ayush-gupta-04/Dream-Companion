import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyDeliveryToTimelineState,
  createTimelineState,
  detectTimelineEvents,
  finishTimelineInnings
} from '../../src/modules/timeline/timelineEventDetector.js';
import { createReplayMatch, replayPlayers, storedDelivery } from '../fixtures/replayMatch.js';

const players = {
  batter: { id: 'batter-1', displayName: 'Batter One' },
  partner: { id: 'partner-1', displayName: 'Partner One' },
  bowler: { id: 'bowler-1', displayName: 'Bowler One' },
  playerOut: { id: 'out-1', displayName: 'Player Out' }
};

function delivery({
  sequence,
  over,
  batter = players.batter,
  nonStriker = players.partner,
  batterRuns = 0,
  totalRuns = batterRuns,
  wickets = []
}) {
  return {
    id: `delivery-${sequence}`,
    inningsId: 'innings-1',
    deliverySequence: sequence,
    displayOver: over,
    displayBallLabel: `${over}.${sequence}`,
    batter,
    nonStriker,
    bowler: players.bowler,
    batterRuns,
    totalRuns,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penaltyRuns: 0,
    occurredAt: null,
    wickets
  };
}

function assertIncrementalDetection(deliveries) {
  const state = createTimelineState();
  const events = [];
  for (let index = 0; index < deliveries.length; index += 1) {
    events.push(...applyDeliveryToTimelineState(state, deliveries[index]));
    const prefix = deliveries.slice(0, index + 1);
    assert.deepEqual(events, detectTimelineEvents({ deliveries: prefix, isInningsComplete: false }),
      `live prefix ${index + 1}`);
    assert.deepEqual([...events, ...finishTimelineInnings(structuredClone(state))],
      detectTimelineEvents({ deliveries: prefix, isInningsComplete: true }),
      `completed prefix ${index + 1}`);
  }
}

test('incremental detection matches full detection after each delivery in both innings', () => {
  for (const innings of createReplayMatch().innings) {
    assertIncrementalDetection(innings.deliveries);
  }
});

test('an over transition emits the previous over before the new delivery events', () => {
  const state = createTimelineState();
  for (let sequence = 1; sequence <= 6; sequence += 1) {
    assert.deepEqual(applyDeliveryToTimelineState(state, storedDelivery({ deliverySequence: sequence })), []);
  }
  const events = applyDeliveryToTimelineState(state, storedDelivery({ deliverySequence: 7, batterRuns: 4 }));
  assert.deepEqual(events.map((event) => [event.eventKey, event.deliverySequence]), [
    ['completed-over:innings-1-delivery-6:maiden', 6],
    ['delivery:innings-1-delivery-7:four', 7]
  ]);
});

test('finishing an empty or previously finished innings emits no events', () => {
  const state = createTimelineState();
  assert.deepEqual(finishTimelineInnings(state), []);
  applyDeliveryToTimelineState(state, storedDelivery());
  applyDeliveryToTimelineState(state, storedDelivery({ deliverySequence: 2 }));
  assert.deepEqual(finishTimelineInnings(state).map((event) => event.eventKey),
    ['completed-over:innings-1-delivery-2:maiden']);
  assert.deepEqual(finishTimelineInnings(state), []);
});

test('each innings owns independent batter, partnership, and over state', () => {
  const first = createTimelineState();
  for (let sequence = 1; sequence <= 8; sequence += 1) {
    applyDeliveryToTimelineState(first, storedDelivery({ deliverySequence: sequence, batterRuns: 6 }));
  }
  const second = createTimelineState();
  const events = applyDeliveryToTimelineState(second, storedDelivery({ inningsId: 'innings-2', batterRuns: 6 }));
  assert.deepEqual(events.map((event) => event.eventKey), ['delivery:innings-2-delivery-1:six']);
  assert.deepEqual(applyDeliveryToTimelineState(first, storedDelivery({ deliverySequence: 9, batterRuns: 6 }))
    .map((event) => event.eventKey), [
    'delivery:innings-1-delivery-9:six',
    'batter-milestone:innings-1:player-a:50',
    'partnership-milestone:innings-1-delivery-1:50'
  ]);
});

test('detects factual delivery events with stable delivery-based keys', () => {
  const events = detectTimelineEvents({
    isInningsComplete: false,
    deliveries: [
      delivery({ sequence: 1, over: 0, batterRuns: 4 }),
      delivery({ sequence: 2, over: 0, batterRuns: 6 }),
      delivery({
        sequence: 3,
        over: 0,
        wickets: [
          {
            wicketSequence: 1,
            countsAsWicket: true,
            kind: 'caught',
            playerOut: players.playerOut
          }
        ]
      })
    ]
  });

  assert.deepEqual(
    events.map((event) => event.type),
    ['FOUR', 'SIX', 'WICKET']
  );
  assert.equal(events[2].eventKey, 'delivery:delivery-3:wicket:1');
  assert.equal(events[2].importanceLevel, 'MAJOR');
});

test('detects player and partnership milestones from accumulated delivery facts', () => {
  const deliveries = Array.from({ length: 17 }, (_, index) =>
    storedDelivery({ deliverySequence: index + 1, batterRuns: 6 })
  );
  const events = detectTimelineEvents({ deliveries, isInningsComplete: true });
  assertIncrementalDetection(deliveries);

  assert.deepEqual(
    events.filter((event) => event.type.endsWith('MILESTONE')).map((event) => [
      event.eventKey, event.deliverySequence, event.eventOrder,
      event.title, event.importanceScore, event.importanceLevel
    ]),
    [
      ['batter-milestone:innings-1:player-a:50', 9, 31, '50 for Zara', 70, 'HIGHLIGHT'],
      ['partnership-milestone:innings-1-delivery-1:50', 9, 41, '50-run partnership', 65, 'HIGHLIGHT'],
      ['batter-milestone:innings-1:player-a:100', 17, 32, '100 for Zara', 90, 'MAJOR'],
      ['partnership-milestone:innings-1-delivery-1:100', 17, 42, '100-run partnership', 85, 'MAJOR']
    ]
  );
});

test('partnerships survive strike swaps, include extras, and reset when a player retires', () => {
  const { batter, partner, replacement } = replayPlayers;
  const deliveries = Array.from({ length: 8 }, (_, index) => storedDelivery({
    deliverySequence: index + 1, batterRuns: 6,
    batter: index % 2 ? partner : batter, nonStriker: index % 2 ? batter : partner
  }));
  deliveries.push(storedDelivery({
    deliverySequence: 9, wides: 2,
    wickets: [{ wicketSequence: 1, playerOut: partner, kind: 'retired hurt', countsAsWicket: false }]
  }));
  for (let index = 0; index < 9; index += 1) {
    deliveries.push(storedDelivery({
      deliverySequence: index + 10, batterRuns: 6,
      batter: index % 2 ? batter : replacement, nonStriker: index % 2 ? replacement : batter
    }));
  }

  const events = detectTimelineEvents({ deliveries, isInningsComplete: false });
  assertIncrementalDetection(deliveries);
  assert.equal(events.some((event) => event.type === 'WICKET'), false);
  assert.equal(events.some((event) => event.type === 'BATTER_MILESTONE'), false);
  assert.deepEqual(
    events.filter((event) => event.type === 'PARTNERSHIP_MILESTONE').map((event) => [
      event.eventKey, event.deliverySequence, event.description
    ]),
    [
      ['partnership-milestone:innings-1-delivery-1:50', 9,
        'Zara and Amir added 50 runs together at 1.3.'],
      ['partnership-milestone:innings-1-delivery-10:50', 18,
        'Zara and Casey added 50 runs together at 2.6.']
    ]
  );
});

test('counts repeated ball labels separately and anchors a penalty-only maiden to its last delivery', () => {
  const deliveries = createReplayMatch().innings[0].deliveries;
  const live = detectTimelineEvents({ deliveries, isInningsComplete: false });
  assert.deepEqual(live.map((event) => [event.eventKey, event.eventOrder]), [
    ['delivery:innings-1-delivery-1:six', 10],
    ['delivery:innings-1-delivery-3:four', 10],
    ['delivery:innings-1-delivery-8:wicket:1', 21],
    ['completed-over:innings-1-delivery-8:expensive', 70]
  ]);
  const complete = detectTimelineEvents({ deliveries, isInningsComplete: true });
  assert.deepEqual(complete.slice(0, -1), live);
  assert.deepEqual(complete.at(-1), {
    inningsId: 'innings-1', deliveryId: 'innings-1-delivery-9', deliverySequence: 9,
    displayOver: 1, displayBallLabel: '1.1', occurredAt: null,
    eventKey: 'completed-over:innings-1-delivery-9:maiden', eventOrder: 60,
    type: 'MAIDEN_OVER', title: 'Maiden over by Dev',
    description: 'Dev conceded no runs in over 1.', importanceScore: 60, importanceLevel: 'HIGHLIGHT'
  });
});

test('waits for an over transition even after six legal dots and preserves a completed partial over', () => {
  const dots = Array.from({ length: 6 }, (_, index) => storedDelivery({ deliverySequence: index + 1 }));
  assert.deepEqual(detectTimelineEvents({ deliveries: dots, isInningsComplete: false }), []);

  // The first ball of the next over can be illegal; the transition still completes the previous over.
  const deliveries = [...dots, storedDelivery({ deliverySequence: 7, wides: 1 })];
  const live = detectTimelineEvents({ deliveries, isInningsComplete: false });
  assert.deepEqual(live.map((event) => event.eventKey), ['completed-over:innings-1-delivery-6:maiden']);

  deliveries.push(storedDelivery({ deliverySequence: 8, byes: 2 }));
  assert.deepEqual(detectTimelineEvents({ deliveries, isInningsComplete: true }), live);
  assert.deepEqual(detectTimelineEvents({ deliveries: dots.slice(0, 2), isInningsComplete: true })
    .map((event) => event.eventKey), ['completed-over:innings-1-delivery-2:maiden']);
});

test('uses the previous two completed over totals for acceleration and slowdown', () => {
  const deliveries = [
    [4, 4, 0, 0, 0, 0], [4, 4, 0, 0, 0, 0],
    [6, 6, 6, 0, 0, 0], [0, 0, 0, 0, 0, 0]
  ].flat().map((batterRuns, index) => storedDelivery({ deliverySequence: index + 1, batterRuns }));
  const events = detectTimelineEvents({ deliveries, isInningsComplete: true });
  assertIncrementalDetection(deliveries);
  assert.deepEqual(
    events.filter((event) => event.type === 'SCORING_RATE_SHIFT').map((event) => [
      event.eventKey, event.description, event.eventOrder, event.importanceScore, event.importanceLevel
    ]),
    [
      ['completed-over:innings-1-delivery-18:acceleration',
        '18 runs came from over 2, after an average of 8.0 across the previous 2 overs.',
        80, 65, 'HIGHLIGHT'],
      ['completed-over:innings-1-delivery-24:slowdown',
        'Only 0 runs came from over 3, after an average of 13.0 across the previous 2 overs.',
        80, 65, 'HIGHLIGHT']
    ]
  );
  assert.deepEqual(events.filter((event) => event.deliverySequence === 24)
    .map((event) => event.eventOrder), [60, 80]);
});

test('uses over transitions rather than a six-delivery assumption for over events', () => {
  const events = detectTimelineEvents({
    isInningsComplete: true,
    deliveries: [
      delivery({ sequence: 1, over: 0, totalRuns: 0 }),
      delivery({ sequence: 2, over: 0, totalRuns: 0 }),
      delivery({ sequence: 3, over: 1, totalRuns: 10 }),
      delivery({ sequence: 4, over: 2, totalRuns: 10 }),
      delivery({ sequence: 5, over: 3, totalRuns: 18 })
    ]
  });

  assert.ok(events.some((event) => event.type === 'MAIDEN_OVER'));
  assert.ok(events.some((event) => event.type === 'EXPENSIVE_OVER'));
  assert.ok(
    events.some(
      (event) =>
        event.type === 'SCORING_RATE_SHIFT' && event.title === 'Scoring rate surged in over 3'
    )
  );
});

test('does not emit an over event for an unfinished current over', () => {
  const events = detectTimelineEvents({
    isInningsComplete: false,
    deliveries: [delivery({ sequence: 1, over: 0, totalRuns: 0 })]
  });

  assert.equal(
    events.some((event) => event.type === 'MAIDEN_OVER'),
    false
  );
});
