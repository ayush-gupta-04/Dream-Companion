import { readFile } from 'node:fs/promises';
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

const wait = (milliseconds, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Replay cancelled'));
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Replay cancelled'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

function checkCancelled(signal) {
  if (signal?.aborted) throw new Error('Replay cancelled');
}

async function loadReplayContext(matchId) {
  const match = await loadMatchForState(matchId);
  if (!match) throw new Error('Replay match not found.');
  const players = new Map(match.players.map(({ player }) => [player.id, player]));
  const latest = match.innings.findLast((innings) => innings.deliveries.length > 0)?.inningsNumber;
  const innings = new Map(match.innings.map((entry) => {
    const finished = entry.inningsNumber < latest;
    return [entry.id, {
      id: entry.id,
      inningsNumber: entry.inningsNumber,
      lastSequence: entry.deliveries.at(-1)?.deliverySequence ?? 0,
      finished,
      state: timelineService.createInningsState({ deliveries: entry.deliveries, players,
        isInningsComplete: finished })
    }];
  }));
  return { score: createMatchStateAccumulator(match), players, innings };
}

export async function replayCricsheetFile({
  filePath,
  sourceMatchId,
  intervalMs,
  signal,
  onProgress,
  pause = wait
}) {
  checkCancelled(signal);
  const rawMatch = JSON.parse(await readFile(filePath, 'utf8'));
  const adaptedMatch = adaptCricsheetMatch(rawMatch, sourceMatchId);
  const preparedMatch = await bootstrapCricsheetMatch(adaptedMatch);
  checkCancelled(signal);

  const totalDeliveries = preparedMatch.innings.reduce(
    (sum, inn) => sum + (inn.deliveries?.length || 0),
    0
  );

  console.log(
    `[Replay] Starting simulation: "${adaptedMatch.name}" (ID: ${preparedMatch.match.id}, Source: ${sourceMatchId})`
  );
  console.log(
    `[Replay] Total innings: ${preparedMatch.innings.length} | Total deliveries: ${totalDeliveries} | Interval: ${intervalMs}ms`
  );

  // Change Match state to LIVE.
  await prisma.match.update({ where: { id: preparedMatch.match.id }, data: { status: 'LIVE' } });
  publishMatchStatus(preparedMatch.match.id, 'LIVE');

  let context = await loadReplayContext(preparedMatch.match.id);
  const initialState = context.score.snapshot();
  // Repair events after an interrupted earlier run, including deliveries now reported unchanged.
  const restoredChanges = [...context.innings.values()].some((entry) => entry.lastSequence > 0)
    ? await timelineService.synchronizeMatch({ matchId: preparedMatch.match.id }) : null;
  checkCancelled(signal);
  await stateCache.set(preparedMatch.match.id, initialState);
  io.to(matchRoom(preparedMatch.match.id)).emit('score_updated', initialState);
  if (restoredChanges) publishTimelineChanges(restoredChanges);

  let processedCount = 0;

  for (const innings of preparedMatch.innings) {
    checkCancelled(signal);

    console.log(
      `[Replay] --- Starting Innings ${innings.inningsNumber} (${innings.deliveries.length} deliveries) ---`
    );

    for (const delivery of innings.deliveries) {
      checkCancelled(signal);

      processedCount += 1;
      const result = await processDelivery({ inningsId: innings.id, delivery });

      if (onProgress) {
        onProgress({
          matchId: preparedMatch.match.id,
          matchName: adaptedMatch.name,
          inningsNumber: innings.inningsNumber,
          ballLabel: delivery.display.ballLabel,
          processedDeliveries: processedCount,
          totalDeliveries
        });
      }

      const current = context.innings.get(innings.id);
      if (result.action === 'unchanged' && result.record.deliverySequence <= current.lastSequence) {
        console.log(
          `[Replay] Inn ${innings.inningsNumber} | Over ${delivery.display.ballLabel} | Action: unchanged (already stored in DB)`
        );
        continue;
      }

      const runsInfo = delivery.runs.batter > 0 ? `${delivery.runs.batter} runs` : 'dot ball';
      const extrasInfo = result.record.totalExtras > 0 ? ` (+${result.record.totalExtras} extras)` : '';
      console.log(
        `[Replay] Inn ${innings.inningsNumber} | Over ${delivery.display.ballLabel} | ${runsInfo}${extrasInfo} | Action: ${result.action}`
      );

      let timelineChanges;
      if (result.action !== 'created' || current.finished ||
          result.record.deliverySequence !== current.lastSequence + 1) {
        context = await loadReplayContext(preparedMatch.match.id);
        timelineChanges = await timelineService.synchronizeMatch({ matchId: preparedMatch.match.id });
      } else {
        context.score.applyDelivery(result.record);
        timelineChanges = await timelineService.recordDelivery({
          matchId: preparedMatch.match.id, delivery: result.record, innings: current,
          players: context.players, state: current.state
        });
        current.lastSequence = result.record.deliverySequence;
      }
      const state = context.score.snapshot();
      await stateCache.set(preparedMatch.match.id, state);
      publishDeliveryUpdate(preparedMatch.match.id, result.action, result.record, state);
      publishTimelineChanges(timelineChanges);

      for (const event of timelineChanges.created) {
        console.log(
          `[Timeline] [${event.type}] [${event.importance.level}] ${event.title}: ${event.description}`
        );
      }
      for (const event of timelineChanges.updated) {
        console.log(`[Timeline:Updated] [${event.type}] ${event.title}`);
      }

      await pause(intervalMs, signal);
    }
    checkCancelled(signal);
    const current = context.innings.get(innings.id);
    publishTimelineChanges(await timelineService.finishInnings({
      matchId: preparedMatch.match.id, innings: current, state: current.state
    }));
    current.finished = true;
  }

  checkCancelled(signal);
  await prisma.match.update({
    where: { id: preparedMatch.match.id },
    data: { status: 'COMPLETE' }
  });
  const finalTimelineChanges = await timelineService.synchronizeMatch({ matchId: preparedMatch.match.id });
  context.score.complete();
  const state = context.score.snapshot();
  await stateCache.set(preparedMatch.match.id, state);
  io.to(matchRoom(preparedMatch.match.id)).emit('score_updated', state);
  publishMatchStatus(preparedMatch.match.id, 'COMPLETE');

  publishTimelineChanges(finalTimelineChanges);

  console.log(
    `[Replay] Simulation completed for "${adaptedMatch.name}". Match status set to COMPLETE.`
  );

  return { matchId: preparedMatch.match.id, state };
}
