import { fingerprint } from '../../utils/crypto.js';

const SOURCE = 'cricsheet';

export class CricsheetAdapterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CricsheetAdapterError';
  }
}

function requireValue(value, label) {
  if (!value) {
    throw new CricsheetAdapterError(`Cricsheet match is missing ${label}.`);
  }
  return value;
}

function sourcePersonId(registry, name) {
  return requireValue(registry?.people?.[name], `a stable registry ID for ${name}`);
}

function normalizeExtras(extras = {}) {
  return {
    wides: extras.wides ?? 0,
    noBalls: extras.noballs ?? 0,
    byes: extras.byes ?? 0,
    legByes: extras.legbyes ?? 0,
    penaltyRuns: extras.penalty ?? 0
  };
}

function normalizeWickets(wickets, registry) {
  return (wickets ?? []).map((wicket) => ({
    playerOutSourceId: sourcePersonId(registry, wicket.player_out),
    kind: wicket.kind,
    countsAsWicket: wicket.kind !== 'retired hurt',
    fielders: (wicket.fielders ?? []).map((fielder) =>
      sourcePersonId(registry, typeof fielder === 'string' ? fielder : fielder.name)
    )
  }));
}

// This function takes that raw data and converts it into a clean, standardized, 
//    internal format that our database and cricket engine can easily use.

export function adaptCricsheetMatch(rawMatch, sourceMatchId) {
  const dataVersion = requireValue(rawMatch?.meta?.data_version, 'meta.data_version');
  if (!dataVersion.startsWith('1.')) {
    throw new CricsheetAdapterError(`Unsupported Cricsheet data version: ${dataVersion}`);
  }

  const info = requireValue(rawMatch.info, 'info');
  const registry = requireValue(info.registry, 'info.registry');
  const teams = requireValue(info.teams, 'info.teams');
  const innings = requireValue(rawMatch.innings, 'innings');
  const ballsPerOver = requireValue(info.balls_per_over, 'info.balls_per_over');
  const playerEntries = Object.entries(requireValue(info.players, 'info.players'));

  const players = playerEntries.flatMap(([teamName, names]) =>
    names.map((displayName) => ({
      sourceId: sourcePersonId(registry, displayName),
      displayName,
      teamSourceId: teamName
    }))
  );

  return {
    source: SOURCE,
    sourceMatchId,
    sourceRevision: String(rawMatch.meta.revision ?? 1),
    name: `${teams.join(' vs ')} — ${info.dates?.[0] ?? 'undated'}`,
    ballsPerOver,
    teams: teams.map((name) => ({ sourceId: name, name })),
    players,
    innings: innings.map((sourceInnings, inningsIndex) => {
      const deliveries = (sourceInnings.overs ?? []).flatMap((over, overIndex) =>
        over.deliveries.map((delivery, deliveryIndex) => ({
          deliverySequence: 0,
          sourceDeliveryId: `${sourceMatchId}:${inningsIndex}:${overIndex}:${deliveryIndex}`,
          sourceRevision: fingerprint(delivery),
          display: {
            overNumber: over.over,
            ballLabel: delivery.actual_delivery
          },
          playerSources: {
            batterId: sourcePersonId(registry, delivery.batter),
            nonStrikerId: sourcePersonId(registry, delivery.non_striker),
            bowlerId: sourcePersonId(registry, delivery.bowler)
          },
          runs: {
            batter: delivery.runs.batter,
            total: delivery.runs.total
          },
          extras: normalizeExtras(delivery.extras),
          wickets: normalizeWickets(delivery.wickets, registry),
          rawPayload: delivery
        }))
      );

      return {
        inningsNumber: inningsIndex + 1,
        sourceInningsId: `${sourceMatchId}:innings:${inningsIndex + 1}`,
        battingTeamSourceId: sourceInnings.team,
        targetRuns: sourceInnings.target?.runs,
        prePenaltyRuns: sourceInnings.penalty_runs?.pre ?? 0,
        postPenaltyRuns: sourceInnings.penalty_runs?.post ?? 0,
        deliveries: deliveries.map((delivery, index) => ({
          ...delivery,
          deliverySequence: index + 1
        }))
      };
    })
  };
}
