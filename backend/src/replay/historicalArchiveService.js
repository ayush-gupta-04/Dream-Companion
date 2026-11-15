import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { prisma } from '../db/prisma.js';
import * as timelineService from '../modules/timeline/timelineService.js';
import { adaptCricsheetMatch } from '../modules/ingestion/cricsheetAdapter.js';
import { processDelivery } from '../modules/ingestion/deliveryProcessor.js';
import { bootstrapCricsheetMatch } from '../modules/ingestion/matchBootstrapService.js';
import { clearMatchSimulationData } from './matchSimulationDataService.js';

function resolveArchiveDirectory(dataDirectory) {
  const candidates = [
    path.resolve(process.cwd(), dataDirectory),
    path.resolve(process.cwd(), 'backend', dataDirectory),
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

async function historicalMatchIsCurrent(adaptedMatch) {
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

async function persistHistoricalMatch(adaptedMatch) {
  const preparedMatch = await bootstrapCricsheetMatch(adaptedMatch);

  // A source revision or an interrupted earlier import starts from a clean
  // delivery-derived record while retaining stable identity records.
  await clearMatchSimulationData({ matchId: preparedMatch.match.id, status: 'SCHEDULED' });

  for (const innings of preparedMatch.innings) {
    for (const delivery of innings.deliveries) {
      await processDelivery({ inningsId: innings.id, delivery });
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
 * Bootstraps the single live replay match so that live simulations are ready immediately.
 */
export async function bootstrapLiveMatch() {
  const { dataDirectory, liveFileName } = config.replay;
  const archiveDirectory = resolveArchiveDirectory(dataDirectory);
  if (!archiveDirectory) {
    throw new Error(`Cricsheet archive directory was not found: ${dataDirectory}`);
  }

  const normalizedLiveFileName = path.basename(liveFileName);
  const liveFilePath = path.join(archiveDirectory, normalizedLiveFileName);
  if (!existsSync(liveFilePath)) {
    throw new Error(
      `Configured live replay file was not found in the archive: ${normalizedLiveFileName}`
    );
  }

  const adaptedMatch = await loadAdaptedMatch(liveFilePath);
  const preparedMatch = await bootstrapCricsheetMatch(adaptedMatch);
  await clearMatchSimulationData({ matchId: preparedMatch.match.id, status: 'LIVE' });

  return {
    archiveDirectory,
    liveFilePath,
    liveMatchId: preparedMatch.match.id
  };
}

/**
 * Seeds historical match archives in the background without blocking server startup.
 */
export async function seedHistoricalArchive({ signal } = {}) {
  if (signal?.aborted) return;
  const { dataDirectory, liveFileName, seedLimit: limit } = config.replay;
  const archiveDirectory = resolveArchiveDirectory(dataDirectory);
  if (!archiveDirectory) return;

  const normalizedLiveFileName = path.basename(liveFileName);
  const allFiles = (await readdir(archiveDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.json')
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
    .filter((fileName) => fileName !== normalizedLiveFileName);

  const fileLimit = limit > 0 ? limit : allFiles.length;
  const targetFiles = allFiles.slice(0, fileLimit);

  console.log(`[Archive] Background seeding started for ${targetFiles.length} historical matches...`);

  let seeded = 0;
  let skipped = 0;

  for (let i = 0; i < targetFiles.length; i++) {
    if (signal?.aborted) break;
    const fileName = targetFiles[i];
    try {
      const adaptedMatch = await loadAdaptedMatch(path.join(archiveDirectory, fileName));
      if (await historicalMatchIsCurrent(adaptedMatch)) {
        skipped++;
        continue;
      }

      console.log(`[Archive] Seeding match (${i + 1}/${targetFiles.length}): ${fileName}...`);
      await persistHistoricalMatch(adaptedMatch);
      seeded++;
    } catch (error) {
      console.error(`[Archive] Could not persist Cricsheet source ${fileName}: ${error.message}`);
    }
  }

  console.log(`[Archive] Background seeding complete: ${seeded} seeded, ${skipped} unchanged.`);
}
