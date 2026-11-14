const DEFAULT_PLAYERS = {
  batterId: 'player-batter',
  nonStrikerId: 'player-non-striker',
  bowlerId: 'player-bowler'
};

export function normalizedDelivery(overrides = {}) {
  const baseDelivery = {
    deliverySequence: 1,
    display: { overNumber: 0, ballLabel: '0.1' },
    players: { ...DEFAULT_PLAYERS },
    runs: { batter: 0, total: 0 },
    extras: {},
    wickets: []
  };

  return {
    ...baseDelivery,
    ...overrides,
    display: { ...baseDelivery.display, ...overrides.display },
    players: { ...baseDelivery.players, ...overrides.players },
    runs: { ...baseDelivery.runs, ...overrides.runs },
    extras: { ...overrides.extras }
  };
}

export const variedInningsDeliveries = [
  normalizedDelivery({
    deliverySequence: 1,
    display: { ballLabel: '0.1' },
    runs: { batter: 1, total: 1 }
  }),
  normalizedDelivery({
    deliverySequence: 2,
    display: { ballLabel: '0.2' }
  }),
  normalizedDelivery({
    deliverySequence: 3,
    display: { ballLabel: '0.3' },
    runs: { batter: 4, total: 4 }
  }),
  normalizedDelivery({
    deliverySequence: 4,
    display: { ballLabel: '0.3 wide' },
    runs: { total: 1 },
    extras: { wides: 1 }
  }),
  normalizedDelivery({
    deliverySequence: 5,
    display: { ballLabel: 'source-label-17.3a' },
    runs: { batter: 1, total: 2 },
    extras: { noBalls: 1 }
  }),
  normalizedDelivery({
    deliverySequence: 6,
    display: { ballLabel: '0.3' },
    runs: { total: 1 },
    extras: { legByes: 1 }
  }),
  normalizedDelivery({
    deliverySequence: 7,
    display: { ballLabel: '0.4' },
    runs: { total: 2 },
    extras: { byes: 2 }
  }),
  normalizedDelivery({
    deliverySequence: 8,
    display: { ballLabel: '0.5' },
    wickets: [{ playerOutId: 'player-batter', kind: 'caught' }]
  })
];
