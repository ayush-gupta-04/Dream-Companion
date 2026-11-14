import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildMatchState } from '../../src/modules/match-intelligence/state/matchStateService.js';

describe('buildMatchState', () => {
  test('returns null when match does not exist', async () => {
    const mockPrisma = {
      match: {
        findUnique: async () => null
      }
    };

    const state = await buildMatchState(mockPrisma, 'non-existent');
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

    const state = await buildMatchState(mockPrisma, 'match-1');

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

    const state = await buildMatchState(mockPrisma, 'match-1');

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

    const state = await buildMatchState(mockPrisma, 'match-1');

    assert.equal(state.currentInnings.inningsNumber, 1);
    assert.equal(state.currentInnings.battingTeam, 'Australia');
    assert.equal(state.currentInnings.state.totalRuns, 0);
  });
});
