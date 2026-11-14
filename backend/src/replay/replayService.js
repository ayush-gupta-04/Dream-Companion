import { readFile } from 'node:fs/promises';
import { adaptCricsheetMatch } from '../modules/ingestion/cricsheetAdapter.js';
import { bootstrapCricsheetMatch } from '../modules/ingestion/matchBootstrapService.js';
import { processDelivery } from '../modules/ingestion/deliveryProcessor.js';
import { buildMatchState } from '../modules/match-intelligence/state/matchStateService.js';
import {
  publishDeliveryUpdate,
  publishMatchStatus,
  publishTimelineChanges
} from '../sockets/socketServer.js';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function replayCricsheetFile({
  filePath,
  sourceMatchId,
  intervalMs,
  prisma,
  stateCache,
  io,
  timelineService,
  pause = wait
}) {
  const rawMatch = JSON.parse(await readFile(filePath, 'utf8'));
  const adaptedMatch = adaptCricsheetMatch(rawMatch, sourceMatchId);
  const preparedMatch = await bootstrapCricsheetMatch(prisma, adaptedMatch);

  await prisma.match.update({ where: { id: preparedMatch.match.id }, data: { status: 'LIVE' } });
  publishMatchStatus(io, preparedMatch.match.id, 'LIVE');

  for (const innings of preparedMatch.innings) {
    for (const delivery of innings.deliveries) {
      const result = await processDelivery(prisma, { inningsId: innings.id, delivery });
      if (result.action === 'unchanged') {
        continue;
      }

      const state = await buildMatchState(prisma, preparedMatch.match.id);  // for redis caching
      await stateCache.set(preparedMatch.match.id, state);

      publishDeliveryUpdate(io, preparedMatch.match.id, result.action, result.record, state);
      if (timelineService) {
        publishTimelineChanges(io,await timelineService.synchronizeMatch({ matchId: preparedMatch.match.id }));
      }
      await pause(intervalMs);
    }
  }

  await prisma.match.update({
    where: { id: preparedMatch.match.id },
    data: { status: 'COMPLETE' }
  });
  const state = await buildMatchState(prisma, preparedMatch.match.id);
  await stateCache.set(preparedMatch.match.id, state);
  publishMatchStatus(io, preparedMatch.match.id, 'COMPLETE');
  if (timelineService) {
    publishTimelineChanges(
      io,
      await timelineService.synchronizeMatch({ matchId: preparedMatch.match.id })
    );
  }

  return { matchId: preparedMatch.match.id, state };
}
