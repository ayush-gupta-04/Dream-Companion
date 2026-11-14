import { CricsheetAdapterError } from './cricsheetAdapter.js';

function mapBySourceId(records) {
  return new Map(records.map((record) => [record.sourceId, record]));
}


// Runs inside a PostgreSQL transaction (prisma.$transaction).
// Upserts Match, Team, Player, MatchTeam, MatchPlayer, and Innings rows.
// Replaces external Cricsheet person/team registry IDs with internal database CUIDs/UUIDs so
//    subsequent delivery processing works solely with internal foreign keys.

export async function bootstrapCricsheetMatch(prisma, adaptedMatch) {
  return prisma.$transaction(async (transaction) => {
    const matchData = {
      name: adaptedMatch.name,
      source: adaptedMatch.source,
      sourceMatchId: adaptedMatch.sourceMatchId,
      sourceRevision: adaptedMatch.sourceRevision,
      ballsPerOver: adaptedMatch.ballsPerOver
    };

    const match = await transaction.match.upsert({
      where: {
        source_sourceMatchId: {
          source: adaptedMatch.source,
          sourceMatchId: adaptedMatch.sourceMatchId
        }
      },
      update: matchData,
      create: matchData
    });

    const teams = [];
    for (const team of adaptedMatch.teams) {
      teams.push(
        await transaction.team.upsert({
          where: {
            source_sourceTeamId: { source: adaptedMatch.source, sourceTeamId: team.sourceId }
          },
          update: { name: team.name },
          create: { source: adaptedMatch.source, sourceTeamId: team.sourceId, name: team.name }
        })
      );
    }

    const teamBySourceId = mapBySourceId(
      teams.map((team) => ({ sourceId: team.sourceTeamId, ...team }))
    );
    for (const team of teams) {
      await transaction.matchTeam.upsert({
        where: { matchId_teamId: { matchId: match.id, teamId: team.id } },
        update: {},
        create: { matchId: match.id, teamId: team.id }
      });
    }

    const players = [];
    for (const player of adaptedMatch.players) {
      const team = teamBySourceId.get(player.teamSourceId);
      if (!team) {
        throw new CricsheetAdapterError(`Player ${player.displayName} has an unknown team.`);
      }

      const storedPlayer = await transaction.player.upsert({
        where: {
          source_sourcePlayerId: { source: adaptedMatch.source, sourcePlayerId: player.sourceId }
        },
        update: { displayName: player.displayName },
        create: {
          source: adaptedMatch.source,
          sourcePlayerId: player.sourceId,
          displayName: player.displayName
        }
      });
      players.push({ sourceId: player.sourceId, ...storedPlayer });
      await transaction.matchPlayer.upsert({
        where: { matchId_playerId: { matchId: match.id, playerId: storedPlayer.id } },
        update: { teamId: team.id },
        create: { matchId: match.id, playerId: storedPlayer.id, teamId: team.id }
      });
    }

    const playerBySourceId = mapBySourceId(players);
    const preparedInnings = [];
    for (const innings of adaptedMatch.innings) {
      const battingTeam = teamBySourceId.get(innings.battingTeamSourceId);
      if (!battingTeam) {
        throw new CricsheetAdapterError(
          `Innings ${innings.inningsNumber} has an unknown batting team.`
        );
      }

      const storedInnings = await transaction.innings.upsert({
        where: {
          matchId_inningsNumber: { matchId: match.id, inningsNumber: innings.inningsNumber }
        },
        update: {
          battingTeamId: battingTeam.id,
          sourceInningsId: innings.sourceInningsId,
          targetRuns: innings.targetRuns,
          prePenaltyRuns: innings.prePenaltyRuns,
          postPenaltyRuns: innings.postPenaltyRuns
        },
        create: {
          matchId: match.id,
          inningsNumber: innings.inningsNumber,
          battingTeamId: battingTeam.id,
          sourceInningsId: innings.sourceInningsId,
          targetRuns: innings.targetRuns,
          prePenaltyRuns: innings.prePenaltyRuns,
          postPenaltyRuns: innings.postPenaltyRuns
        }
      });

      preparedInnings.push({
        ...storedInnings,
        deliveries: innings.deliveries.map((delivery) => ({
          deliverySequence: delivery.deliverySequence,
          display: delivery.display,
          players: {
            batterId: playerBySourceId.get(delivery.playerSources.batterId)?.id,
            nonStrikerId: playerBySourceId.get(delivery.playerSources.nonStrikerId)?.id,
            bowlerId: playerBySourceId.get(delivery.playerSources.bowlerId)?.id
          },
          runs: delivery.runs,
          extras: delivery.extras,
          wickets: delivery.wickets.map((wicket) => ({
            playerOutId: playerBySourceId.get(wicket.playerOutSourceId)?.id,
            kind: wicket.kind,
            countsAsWicket: wicket.countsAsWicket,
            fielders: wicket.fielders
          })),
          source: {
            provider: adaptedMatch.source,
            deliveryId: delivery.sourceDeliveryId,
            revision: delivery.sourceRevision
          },
          rawPayload: delivery.rawPayload
        }))
      });
    }

    return { match, innings: preparedInnings };
  });
}
