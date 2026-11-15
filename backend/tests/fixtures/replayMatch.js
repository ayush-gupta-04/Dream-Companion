export const replayPlayers = {
  batter: { id: 'player-a', displayName: 'Zara' },
  partner: { id: 'player-b', displayName: 'Amir' },
  replacement: { id: 'player-c', displayName: 'Casey' },
  bowler: { id: 'player-d', displayName: 'Dev' }
};

// A persisted delivery, including the player relations used by timeline detection.
export function storedDelivery({
  inningsId = 'innings-1',
  deliverySequence = 1,
  displayOver = Math.floor((deliverySequence - 1) / 6),
  batter = replayPlayers.batter,
  nonStriker = replayPlayers.partner,
  bowler = replayPlayers.bowler,
  batterRuns = 0,
  wides = 0,
  noBalls = 0,
  byes = 0,
  legByes = 0,
  penaltyRuns = 0,
  ...overrides
} = {}) {
  const totalExtras = wides + noBalls + byes + legByes + penaltyRuns;
  return {
    id: `${inningsId}-delivery-${deliverySequence}`,
    inningsId,
    deliverySequence,
    displayOver,
    displayBallLabel: `${displayOver}.${(deliverySequence - 1) % 6 + 1}`,
    batterId: batter.id,
    nonStrikerId: nonStriker.id,
    bowlerId: bowler.id,
    batter,
    nonStriker,
    bowler,
    batterRuns,
    totalExtras,
    totalRuns: batterRuns + totalExtras,
    wides,
    noBalls,
    byes,
    legByes,
    penaltyRuns,
    isLegalDelivery: wides === 0 && noBalls === 0,
    occurredAt: null,
    sourceDeliveryId: null,
    wickets: [],
    ...overrides
  };
}

export function createReplayMatch() {
  const { batter, partner, replacement, bowler } = replayPlayers;
  const firstInnings = [
    { batterRuns: 6 },
    { batterRuns: 1 },
    { batter: partner, nonStriker: batter, batterRuns: 4 },
    { batter: partner, nonStriker: batter, wides: 2, displayBallLabel: '0.3' },
    { batter: partner, nonStriker: batter, batterRuns: 2, noBalls: 1, displayBallLabel: '0.3' },
    { batter: partner, nonStriker: batter, byes: 2, displayBallLabel: '0.4' },
    { batter: partner, nonStriker: batter, legByes: 1, displayBallLabel: '0.5' },
    {
      batter: partner, nonStriker: batter, displayBallLabel: '0.6',
      wickets: [{ wicketSequence: 1, playerOutId: partner.id, playerOut: partner,
        kind: 'caught', countsAsWicket: true }]
    },
    { batter: replacement, nonStriker: batter, displayOver: 1,
      displayBallLabel: '1.1', penaltyRuns: 5 }
  ].map((values, index) => storedDelivery({
    deliverySequence: index + 1, displayOver: 0, ...values
  }));
  const secondInnings = [
    { batterRuns: 4 },
    { batterRuns: 1, wickets: [{ wicketSequence: 1, playerOutId: batter.id, playerOut: batter,
      kind: 'run out', countsAsWicket: true }] }
  ].map((values, index) => storedDelivery({
    inningsId: 'innings-2', deliverySequence: index + 1,
    batter: bowler, nonStriker: batter, bowler: partner, ...values
  }));

  return {
    id: 'match-1', name: 'North XI vs South XI', status: 'LIVE', ballsPerOver: 6,
    players: Object.values(replayPlayers).map((player) => ({ playerId: player.id, player })),
    innings: [
      { id: 'innings-1', inningsNumber: 1, battingTeam: { name: 'North XI' },
        targetRuns: null, prePenaltyRuns: 5, postPenaltyRuns: 5, deliveries: firstInnings },
      { id: 'innings-2', inningsNumber: 2, battingTeam: { name: 'South XI' },
        targetRuns: 35, prePenaltyRuns: 0, postPenaltyRuns: 0, deliveries: secondInnings }
    ]
  };
}
