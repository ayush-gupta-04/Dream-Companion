import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { adaptCricsheetMatch } from '../modules/ingestion/cricsheetAdapter.js';
import { processDelivery } from '../modules/ingestion/deliveryProcessor.js';
import { bootstrapCricsheetMatch } from '../modules/ingestion/matchBootstrapService.js';
import { clearMatchSimulationData } from './matchSimulationDataService.js';

function resolveArchiveDirectory(dataDirectory) {
  const candidates = [
    path.resolve(process.cwd(), dataDirectory),
    path.resolve(process.cwd(), '..', dataDirectory)
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function sourceMatchIdFor(fileName) {
  return path.basename(fileName, path.extname(fileName));
}

async function loadAdaptedMatch(filePath) {
  const sourceMatchId = sourceMatchIdFor(filePath);
  const rawMatch = JSON.parse(await readFile(filePath, 'utf8'));
  return adaptCricsheetMatch(rawMatch, sourceMatchId);
}

async function historicalMatchIsCurrent(prisma, adaptedMatch) {
  const existing = await prisma.match.findUnique({
    where: {
      source_sourceMatchId: {
        source: adaptedMatch.source,
        sourceMatchId: adaptedMatch.sourceMatchId
      }
    },
    select: { id: true, sourceRevision: true, status: true }
  });

  return existing?.sourceRevision === adaptedMatch.sourceRevision && existing.status === 'COMPLETE';
}

async function persistHistoricalMatch({ prisma, stateCache, timelineService, adaptedMatch }) {
  const preparedMatch = await bootstrapCricsheetMatch(prisma, adaptedMatch);

  // A source revision or an interrupted earlier import starts from a clean
  // delivery-derived record while retaining stable identity records.
  await clearMatchSimulationData({
    prisma,
    stateCache,
    matchId: preparedMatch.match.id,
    status: 'SCHEDULED'
  });

  for (const innings of preparedMatch.innings) {
    for (const delivery of innings.deliveries) {
      await processDelivery(prisma, { inningsId: innings.id, delivery });
    }
  }

  await prisma.match.update({
    where: { id: preparedMatch.match.id },
    data: { status: 'COMPLETE' }
  });
  await timelineService.synchronizeMatch({ matchId: preparedMatch.match.id });

  return preparedMatch.match.id;
}

/**
 * Persists every historical file before the API starts. The configured live
 * file is bootstrapped as a card-ready match, but its delivery data is always
 * cleared so that it can be replayed on the first workspace visit.
 */
export async function bootstrapHistoricalArchive({
  prisma,
  stateCache,
  timelineService,
  dataDirectory,
  liveFileName
}) {
  const archiveDirectory = resolveArchiveDirectory(dataDirectory);
  if (!archiveDirectory) {
    throw new Error(`Cricsheet archive directory was not found: ${dataDirectory}`);
  }

  const normalizedLiveFileName = path.basename(liveFileName);
  if (normalizedLiveFileName !== liveFileName) {
    throw new Error('LIVE_REPLAY_FILE must name a JSON file within CRICSHEET_DATA_DIR.');
  }

  const fileNames = (await readdir(archiveDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.json')
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (fileNames.length === 0) {
    throw new Error(`Cricsheet archive directory has no JSON match files: ${archiveDirectory}`);
  }
  if (!fileNames.includes(normalizedLiveFileName)) {
    throw new Error(
      `Configured live replay file was not found in the archive: ${normalizedLiveFileName}`
    );
  }

  const result = {
    archiveDirectory,
    liveFilePath: path.join(archiveDirectory, normalizedLiveFileName),
    liveMatchId: null,
    historicalMatchesSeeded: 0,
    historicalMatchesSkipped: 0,
    totalFiles: fileNames.length
  };

  for (const fileName of fileNames) {
    const adaptedMatch = await loadAdaptedMatch(path.join(archiveDirectory, fileName));

    if (fileName === normalizedLiveFileName) {
      const preparedMatch = await bootstrapCricsheetMatch(prisma, adaptedMatch);
      await clearMatchSimulationData({
        prisma,
        stateCache,
        matchId: preparedMatch.match.id,
        status: 'LIVE'
      });
      result.liveMatchId = preparedMatch.match.id;
      continue;
    }

    if (await historicalMatchIsCurrent(prisma, adaptedMatch)) {
      result.historicalMatchesSkipped += 1;
      continue;
    }

    try {
      await persistHistoricalMatch({ prisma, stateCache, timelineService, adaptedMatch });
      result.historicalMatchesSeeded += 1;
    } catch (error) {
      error.message = `Could not persist Cricsheet source ${fileName}: ${error.message}`;
      throw error;
    }
  }

  return result;
}
