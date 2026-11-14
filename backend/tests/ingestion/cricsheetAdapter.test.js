import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adaptCricsheetMatch } from '../../src/modules/ingestion/cricsheetAdapter.js';

const syntheticCricsheetMatch = {
  meta: { data_version: '1.3.0', revision: 1 },
  info: {
    balls_per_over: 6,
    dates: ['2026-01-01'],
    teams: ['Alpha', 'Beta'],
    players: { Alpha: ['A Batter', 'A Partner'], Beta: ['B Bowler'] },
    registry: {
      people: {
        'A Batter': 'aaaa0001',
        'A Partner': 'aaaa0002',
        'B Bowler': 'bbbb0001'
      }
    }
  },
  innings: [
    {
      team: 'Alpha',
      penalty_runs: { pre: 5 },
      overs: [
        {
          over: 0,
          deliveries: [
            {
              actual_delivery: '0.1',
              batter: 'A Batter',
              non_striker: 'A Partner',
              bowler: 'B Bowler',
              extras: { wides: 1 },
              runs: { batter: 0, extras: 1, total: 1 }
            },
            {
              actual_delivery: '0.1',
              batter: 'A Batter',
              non_striker: 'A Partner',
              bowler: 'B Bowler',
              wickets: [
                {
                  kind: 'caught',
                  player_out: 'A Batter',
                  fielders: [{ substitute: true }]
                }
              ],
              runs: { batter: 0, extras: 0, total: 0 }
            }
          ]
        }
      ]
    }
  ]
};

test('adapts Cricsheet deliveries using array position instead of repeated labels', () => {
  const match = adaptCricsheetMatch(syntheticCricsheetMatch, 'demo-match');
  const [first, second] = match.innings[0].deliveries;

  assert.equal(match.ballsPerOver, 6);
  assert.equal(match.innings[0].prePenaltyRuns, 5);
  assert.equal(first.display.ballLabel, '0.1');
  assert.equal(second.display.ballLabel, '0.1');
  assert.equal(first.deliverySequence, 1);
  assert.equal(second.deliverySequence, 2);
  assert.notEqual(first.sourceDeliveryId, second.sourceDeliveryId);
  assert.equal(first.extras.wides, 1);
  assert.equal(second.wickets[0].playerOutSourceId, 'aaaa0001');
  assert.deepEqual(second.wickets[0].fielders, []);
});
