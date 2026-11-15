import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { createReplayMatch } from '../fixtures/replayMatch.js';

let activePrisma;
const prisma = { match: { findUnique: (...args) => activePrisma.match.findUnique(...args) } };
mock.module('../../src/db/prisma.js', { exports: { prisma } });
const { buildMatchState } =
  await import('../../src/modules/match-intelligence/state/matchStateService.js');

describe('buildMatchState', () => {
  test('preserves the public scorecard, player names, extras, and innings separation', async () => {
    const match = createReplayMatch();
    activePrisma = { match: { findUnique: async () => match } };

    const { updatedAt, ...state } = await buildMatchState(match.id);
    const innings = [
      {
        id: 'innings-1', inningsNumber: 1, battingTeam: 'North XI', targetRuns: null,
        state: {
          totalRuns: 29, wickets: 1, legalDeliveries: 7, overs: '1.1', ballsPerOver: 6,
          extras: { wides: 2, noBalls: 1, byes: 2, legByes: 1, penaltyRuns: 5 },
          batters: {
            Zara: { runs: 7, ballsFaced: 2, fours: 0, sixes: 1, strikeRate: 350 },
            Amir: { runs: 6, ballsFaced: 5, fours: 1, sixes: 0, strikeRate: 120 },
            Casey: { runs: 0, ballsFaced: 1, fours: 0, sixes: 0, strikeRate: 0 }
          },
          bowlers: {
            Dev: { legalDeliveries: 7, overs: '1.1', runsConceded: 16,
              wickets: 1, economy: 13.71 }
          }
        }
      },
      {
        id: 'innings-2', inningsNumber: 2, battingTeam: 'South XI', targetRuns: 35,
        state: {
          totalRuns: 5, wickets: 1, legalDeliveries: 2, overs: '0.2', ballsPerOver: 6,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penaltyRuns: 0 },
          batters: { Dev: { runs: 5, ballsFaced: 2, fours: 1, sixes: 0, strikeRate: 250 } },
          bowlers: {
            Amir: { legalDeliveries: 2, overs: '0.2', runsConceded: 5, wickets: 0, economy: 15 }
          }
        }
      }
    ];
    assert.deepEqual(state, {
      matchId: match.id, name: match.name, status: 'LIVE', ballsPerOver: 6,
      currentInnings: innings[1], innings
    });
    assert.equal(new Date(updatedAt).toISOString(), updatedAt);
  });

  test('keeps each delivery prefix score and the active innings correct', async () => {
    const match = createReplayMatch();
    const [first, second] = match.innings;
    const firstDeliveries = first.deliveries;
    const secondDeliveries = second.deliveries;
    second.deliveries = [];
    activePrisma = { match: { findUnique: async () => match } };

    // Includes the pre-innings penalty; repeated ball labels still count separately.
    const totals = [5, 11, 12, 16, 18, 21, 23, 24, 24, 29];
    const legalBalls = [0, 1, 2, 3, 3, 3, 4, 5, 6, 7];
    for (let count = 0; count <= firstDeliveries.length; count += 1) {
      first.deliveries = firstDeliveries.slice(0, count);
      const state = await buildMatchState(match.id);
      assert.equal(state.currentInnings.inningsNumber, 1);
      assert.equal(state.currentInnings.state.totalRuns, totals[count], `prefix ${count}`);
      assert.equal(state.currentInnings.state.legalDeliveries, legalBalls[count], `prefix ${count}`);
      assert.equal(state.currentInnings.state.wickets, count >= 8 ? 1 : 0);
      assert.equal(state.innings[1].state.totalRuns, 0);
    }

    second.deliveries = secondDeliveries.slice(0, 1);
    const state = await buildMatchState(match.id);
    assert.equal(state.currentInnings.inningsNumber, 2);
    assert.equal(state.currentInnings.state.totalRuns, 4);
    assert.equal(state.innings[0].state.totalRuns, 29);
  });

  test('adds post-innings penalties only for a completed match and never credits them to players', async () => {
    const match = createReplayMatch();
    activePrisma = { match: { findUnique: async () => match } };
    const live = await buildMatchState(match.id);
    match.status = 'COMPLETE';
    const complete = await buildMatchState(match.id);
    const repeated = await buildMatchState(match.id);

    assert.equal(complete.status, 'COMPLETE');
    assert.deepEqual(complete.innings[0].state, { ...live.innings[0].state, totalRuns: 34 });
    assert.deepEqual(complete.innings[1], live.innings[1]);
    assert.deepEqual(repeated.innings, complete.innings);
  });

  test('returns null when match does not exist', async () => {
    const mockPrisma = {
      match: {
        findUnique: async () => null
      }
    };

    activePrisma = mockPrisma;
    const state = await buildMatchState('non-existent');
    assert.equal(state, null);
  });

  test('selects Innings 1 as currentInnings when Innings 1 has deliveries and Innings 2 has none', async () => {
    const mockPrisma = {
      match: {
        findUnique: async () => ({
          id: 'match-1',
          name: 'Australia vs Sri Lanka',
          status: 'LIVE',
          ballsPerOver: 6,
          players: [
            { playerId: 'p1', player: { id: 'p1', displayName: 'D Warner' } },
            { playerId: 'p2', player: { id: 'p2', displayName: 'L Malinga' } }
          ],
          innings: [
            {
              id: 'inn-1',
              inningsNumber: 1,
              battingTeam: { name: 'Australia' },
              targetRuns: null,
              prePenaltyRuns: 0,
              postPenaltyRuns: 0,
              deliveries: [
                {
                  id: 'del-1',
                  deliverySequence: 1,
                  displayOver: 0,
                  displayBallLabel: '0.1',
                  batterId: 'p1',
                  nonStrikerId: 'p1',
                  bowlerId: 'p2',
                  batterRuns: 4,
                  totalExtras: 0,
                  totalRuns: 4,
                  wides: 0,
                  noBalls: 0,
                  byes: 0,
                  legByes: 0,
                  penaltyRuns: 0,
                  isLegalDelivery: true,
                  occurredAt: null,
                  wickets: []
                }
              ]
            },
            {
              id: 'inn-2',
              inningsNumber: 2,
              battingTeam: { name: 'Sri Lanka' },
              targetRuns: 180,
              prePenaltyRuns: 0,
              postPenaltyRuns: 0,
              deliveries: []
            }
          ]
        })
      }
    };

    activePrisma = mockPrisma;
    const state = await buildMatchState('match-1');

    assert.equal(state.matchId, 'match-1');
    assert.equal(state.currentInnings.inningsNumber, 1);
    assert.equal(state.currentInnings.battingTeam, 'Australia');
    assert.equal(state.currentInnings.state.totalRuns, 4);
    assert.equal(state.currentInnings.state.overs, '0.1');

    // Asserts player display names are mapped
    assert.ok(state.currentInnings.state.batters['D Warner']);
    assert.equal(state.currentInnings.state.batters['D Warner'].runs, 4);
    assert.ok(state.currentInnings.state.bowlers['L Malinga']);
    assert.equal(state.currentInnings.state.bowlers['L Malinga'].runsConceded, 4);
  });

  test('selects Innings 2 as currentInnings once Innings 2 has deliveries', async () => {
    const mockPrisma = {
      match: {
        findUnique: async () => ({
          id: 'match-1',
          name: 'Australia vs Sri Lanka',
          status: 'LIVE',
          ballsPerOver: 6,
          players: [],
          innings: [
            {
              id: 'inn-1',
              inningsNumber: 1,
              battingTeam: { name: 'Australia' },
              targetRuns: null,
              prePenaltyRuns: 0,
              postPenaltyRuns: 0,
              deliveries: [
                {
                  id: 'del-1',
                  deliverySequence: 1,
                  displayOver: 0,
                  displayBallLabel: '0.1',
                  batterId: 'p1',
                  nonStrikerId: 'p1',
                  bowlerId: 'p2',
                  batterRuns: 1,
                  totalExtras: 0,
                  totalRuns: 1,
                  wides: 0,
                  noBalls: 0,
                  byes: 0,
                  legByes: 0,
                  penaltyRuns: 0,
                  isLegalDelivery: true,
                  occurredAt: null,
                  wickets: []
                }
              ]
            },
            {
              id: 'inn-2',
              inningsNumber: 2,
              battingTeam: { name: 'Sri Lanka' },
              targetRuns: 150,
              prePenaltyRuns: 0,
              postPenaltyRuns: 0,
              deliveries: [
                {
                  id: 'del-2',
                  deliverySequence: 1,
                  displayOver: 0,
                  displayBallLabel: '0.1',
                  batterId: 'p3',
                  nonStrikerId: 'p3',
                  bowlerId: 'p4',
                  batterRuns: 6,
                  totalExtras: 0,
                  totalRuns: 6,
                  wides: 0,
                  noBalls: 0,
                  byes: 0,
                  legByes: 0,
                  penaltyRuns: 0,
                  isLegalDelivery: true,
                  occurredAt: null,
                  wickets: []
                }
              ]
            }
          ]
        })
      }
    };

    activePrisma = mockPrisma;
    const state = await buildMatchState('match-1');

    assert.equal(state.currentInnings.inningsNumber, 2);
    assert.equal(state.currentInnings.battingTeam, 'Sri Lanka');
    assert.equal(state.currentInnings.state.totalRuns, 6);
  });

  test('defaults to Innings 1 when match has started but no deliveries have been bowled yet', async () => {
    const mockPrisma = {
      match: {
        findUnique: async () => ({
          id: 'match-1',
          name: 'Australia vs Sri Lanka',
          status: 'LIVE',
          ballsPerOver: 6,
          players: [],
          innings: [
            {
              id: 'inn-1',
              inningsNumber: 1,
              battingTeam: { name: 'Australia' },
              targetRuns: null,
              prePenaltyRuns: 0,
              postPenaltyRuns: 0,
              deliveries: []
            },
            {
              id: 'inn-2',
              inningsNumber: 2,
              battingTeam: { name: 'Sri Lanka' },
              targetRuns: null,
              prePenaltyRuns: 0,
              postPenaltyRuns: 0,
              deliveries: []
            }
          ]
        })
      }
    };

    activePrisma = mockPrisma;
    const state = await buildMatchState('match-1');

    assert.equal(state.currentInnings.inningsNumber, 1);
    assert.equal(state.currentInnings.battingTeam, 'Australia');
    assert.equal(state.currentInnings.state.totalRuns, 0);
  });
});
