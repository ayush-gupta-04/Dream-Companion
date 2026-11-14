import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectTimelineEvents } from '../../src/modules/timeline/timelineEventDetector.js';

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
  const deliveries = Array.from({ length: 10 }, (_, index) =>
    delivery({ sequence: index + 1, over: 0, batterRuns: 10 })
  );
  const events = detectTimelineEvents({ deliveries, isInningsComplete: true });

  assert.deepEqual(
    events.filter((event) => event.type === 'BATTER_MILESTONE').map((event) => event.title),
    ['50 for Batter One', '100 for Batter One']
  );
  assert.deepEqual(
    events.filter((event) => event.type === 'PARTNERSHIP_MILESTONE').map((event) => event.title),
    ['50-run partnership', '100-run partnership']
  );
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
