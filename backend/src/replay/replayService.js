import { readFile } from 'node:fs/promises';
import { adaptCricsheetMatch } from '../modules/ingestion/cricsheetAdapter.js';
import { bootstrapCricsheetMatch } from '../modules/ingestion/matchBootstrapService.js';
import { processDelivery } from '../modules/ingestion/deliveryProcessor.js';
import { buildMatchState } from '../modules/match-intelligence/state/matchStateService.js';
import {
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

export async function replayCricsheetFile({
  filePath,
  sourceMatchId,
  intervalMs,
  prisma,
  stateCache,
  io,
  timelineService,
  signal,
  onProgress,
  pause = wait
}) {
  const rawMatch = JSON.parse(await readFile(filePath, 'utf8'));
  const adaptedMatch = adaptCricsheetMatch(rawMatch, sourceMatchId);
  const preparedMatch = await bootstrapCricsheetMatch(prisma, adaptedMatch);

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
  if (io) {
    publishMatchStatus(io, preparedMatch.match.id, 'LIVE');
  }



  const initialState = await buildMatchState(prisma, preparedMatch.match.id);
  if (stateCache && typeof stateCache.set === 'function') {
    await stateCache.set(preparedMatch.match.id, initialState);
  }
  if (io) {
    io.to(matchRoom(preparedMatch.match.id)).emit('score_updated', initialState);
  }

  let processedCount = 0;

  for (const innings of preparedMatch.innings) {
    if (signal?.aborted) {
      console.log('[Replay] Simulation stopped before processing innings.');
      throw new Error('Replay cancelled');
    }

    console.log(
      `[Replay] --- Starting Innings ${innings.inningsNumber} (${innings.deliveries.length} deliveries) ---`
    );


    // Processing every Deliveries one by one.
    for (const delivery of innings.deliveries) {
      if (signal?.aborted) {
        console.log('[Replay] Simulation stopped.');
        throw new Error('Replay cancelled');
      }

      processedCount += 1;
      // Save the delivery to the DB.
      const result = await processDelivery(prisma, { inningsId: innings.id, delivery });

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

      if (result.action === 'unchanged') {
        console.log(
          `[Replay] Inn ${innings.inningsNumber} | Over ${delivery.display.ballLabel} | Action: unchanged (already stored in DB)`
        );
        continue;
      }

      const runsInfo = delivery.runs.batter > 0 ? `${delivery.runs.batter} runs` : 'dot ball';
      const extrasInfo = delivery.extras?.total > 0 ? ` (+${delivery.extras.total} extras)` : '';
      console.log(
        `[Replay] Inn ${innings.inningsNumber} | Over ${delivery.display.ballLabel} | ${runsInfo}${extrasInfo} | Action: ${result.action}`
      );


      const state = await buildMatchState(prisma, preparedMatch.match.id);  // saving the current match state to DB
      if (stateCache && typeof stateCache.set === 'function') {  // saving the current match state to REDIS
        await stateCache.set(preparedMatch.match.id, state);
      }
      // Publish the current match state.
      if (io) {
        publishDeliveryUpdate(io, preparedMatch.match.id, result.action, result.record, state);
      }


      // Creating the Timeline Events (Fast-path per delivery).
      if (timelineService) {
        const timelineChanges =
          typeof timelineService.recordDelivery === 'function'
            ? await timelineService.recordDelivery({
                matchId: preparedMatch.match.id,
                deliveryId: result.record.id,
                action: result.action
              })
            : await timelineService.synchronizeMatch({ matchId: preparedMatch.match.id });

        if (io) {
          publishTimelineChanges(io, timelineChanges);
        }

        for (const event of timelineChanges.created) {
          console.log(
            `[Timeline] [${event.type}] [${event.importanceLevel}] ${event.title}: ${event.description}`
          );
        }
        for (const event of timelineChanges.updated) {
          console.log(`[Timeline:Updated] [${event.type}] ${event.title}`);
        }
      }

      await pause(intervalMs, signal);
    }
  }

  await prisma.match.update({
    where: { id: preparedMatch.match.id },
    data: { status: 'COMPLETE' }
  });
  const state = await buildMatchState(prisma, preparedMatch.match.id);
  if (stateCache && typeof stateCache.set === 'function') {
    await stateCache.set(preparedMatch.match.id, state);
  }
  if (io) {
    io.to(matchRoom(preparedMatch.match.id)).emit('score_updated', state);
  }
  if (io) {
    publishMatchStatus(io, preparedMatch.match.id, 'COMPLETE');
  }

  if (timelineService) {
    const finalTimelineChanges = await timelineService.synchronizeMatch({
      matchId: preparedMatch.match.id
    });
    if (io) {
      publishTimelineChanges(io, finalTimelineChanges);
    }
  }

  console.log(
    `[Replay] Simulation completed for "${adaptedMatch.name}". Match status set to COMPLETE.`
  );

  return { matchId: preparedMatch.match.id, state };
}
