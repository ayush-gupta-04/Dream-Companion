import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { prisma } from '../db/prisma.js';
import { adaptCricsheetMatch } from '../modules/ingestion/cricsheetAdapter.js';
import { bootstrapCricsheetMatch } from '../modules/ingestion/matchBootstrapService.js';
import { processDelivery } from '../modules/ingestion/deliveryProcessor.js';
import { loadMatchForState } from '../modules/match-intelligence/state/matchStateService.js';
import { createMatchStateAccumulator } from '../modules/match-intelligence/state/matchStateAccumulator.js';
import * as stateCache from '../modules/match-intelligence/state/matchStateCache.js';
import * as timelineService from '../modules/timeline/timelineService.js';
import {
  io,
  matchRoom,
  publishDeliveryUpdate,
  publishMatchStatus,
  publishTimelineChanges
} from '../sockets/socketServer.js';

const wait = (milliseconds, signal) => delay(milliseconds, undefined, { signal });

async function commitScore(matchId, state) {
  await stateCache.set(matchId, state);
  io.to(matchRoom(matchId)).emit('score_updated', state);
}

async function loadReplayContext(matchId) {
  const match = await loadMatchForState(matchId);
  if (!match) throw new Error('Replay match not found.');
  const players = new Map(match.players.map(({ player }) => [player.id, player]));
  const innings = new Map(
    match.innings.map((entry) => [
      entry.id,
      {
        id: entry.id,
        inningsNumber: entry.inningsNumber,
        state: timelineService.createInningsState({ deliveries: [], players })
      }
    ])
  );
  return { score: createMatchStateAccumulator(match), players, innings };
}

export async function replayCricsheetFile({
  filePath,
  sourceMatchId,
  intervalMs,
  signal,
  pause = wait
}) {
  signal?.throwIfAborted();
  const rawMatch = JSON.parse(await readFile(filePath, 'utf8'));
  const adaptedMatch = adaptCricsheetMatch(rawMatch, sourceMatchId);
  const preparedMatch = await bootstrapCricsheetMatch(adaptedMatch);
  const matchId = preparedMatch.match.id;

  console.log(
    `[Replay] Starting simulation: "${adaptedMatch.name}" (ID: ${matchId}, Interval: ${intervalMs}ms)`
  );

  publishMatchStatus(matchId, 'LIVE');

  const context = await loadReplayContext(matchId);
  const initialState = context.score.snapshot();
  signal?.throwIfAborted();
  await commitScore(matchId, initialState);

  for (const innings of preparedMatch.innings) {
    console.log(
      `[Replay] --- Starting Innings ${innings.inningsNumber} (${innings.deliveries.length} deliveries) ---`
    );

    const current = context.innings.get(innings.id);

    for (const delivery of innings.deliveries) {
      signal?.throwIfAborted();

      const result = await processDelivery({ inningsId: innings.id, delivery });

      context.score.applyDelivery(result.record);
      const timelineChanges = await timelineService.recordDelivery({
        matchId,
        delivery: result.record,
        innings: current,
        players: context.players,
        state: current.state
      });

      const state = context.score.snapshot();
      await stateCache.set(matchId, state);
      publishDeliveryUpdate(matchId, result.action, result.record, state);
      publishTimelineChanges(timelineChanges);

      await pause(intervalMs, signal);
    }

    signal?.throwIfAborted();
    publishTimelineChanges(
      await timelineService.finishInnings({
        matchId,
        innings: current,
        state: current.state
      })
    );
  }

  signal?.throwIfAborted();
  await prisma.match.update({
    where: { id: matchId },
    data: { status: 'COMPLETE' }
  });
  context.score.complete();
  const state = context.score.snapshot();
  await commitScore(matchId, state);
  publishMatchStatus(matchId, 'COMPLETE');

  console.log(
    `[Replay] Simulation completed for "${adaptedMatch.name}". Match status set to COMPLETE.`
  );

  return { matchId, state };
}
