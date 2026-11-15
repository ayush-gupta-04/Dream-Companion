import path from 'node:path';
import { config } from '../config/index.js';
import { prisma } from '../db/prisma.js';
import { replayCricsheetFile } from './replayService.js';
import { clearMatchSimulationData } from './matchSimulationDataService.js';

let liveFilePath = '';
let liveSourceMatchId = config.replay.liveFileName.replace(/\.json$/i, '');
let liveMatchId = null;
let isRunning = false;
let status = 'IDLE';
let errorMessage = null;
let abortController = null;
let activeReplayPromise = null;
let progress = {
  matchId: null,
  matchName: null,
  inningsNumber: null,
  ballLabel: null,
  processedDeliveries: 0,
  totalDeliveries: 0
};

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

export function registerLiveMatch({ matchId, liveFilePath: filePath }) {
  liveMatchId = matchId;
  if (filePath) {
    liveFilePath = filePath;
    liveSourceMatchId = path.basename(filePath, path.extname(filePath));
  }
}

export function isLiveMatchId(matchId) {
  return Boolean(matchId && liveMatchId === matchId);
}

export function getStatus() {
  return { isRunning, status, error: errorMessage, progress: { ...progress } };
}

async function requireLiveMatch(matchId) {
  if (isLiveMatchId(matchId)) return { id: matchId };
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, source: true, sourceMatchId: true }
  });
  if (!match) throw notFound('Match not found.');
  if (match.source !== 'cricsheet' || match.sourceMatchId !== liveSourceMatchId) {
    throw notFound('This match is not configured for live simulation.');
  }
  liveMatchId = match.id;
  return match;
}

export async function startForMatch(matchId) {
  const match = await requireLiveMatch(matchId);
  if (isRunning) return { status: 'running', matchId: match.id };
  if (!liveFilePath) {
    const error = new Error('The configured live replay file is unavailable.');
    error.statusCode = 503;
    throw error;
  }

  isRunning = true;
  status = 'STARTING';
  errorMessage = null;
  progress = {
    matchId: match.id,
    matchName: null,
    inningsNumber: null,
    ballLabel: null,
    processedDeliveries: 0,
    totalDeliveries: 0
  };
  abortController = new AbortController();

  try {
    await clearMatchSimulationData({ matchId: match.id, status: 'LIVE' });
    status = 'RUNNING';
    activeReplayPromise = replayCricsheetFile({
      filePath: liveFilePath,
      sourceMatchId: liveSourceMatchId,
      intervalMs: config.replay.deliveryIntervalMs,
      signal: abortController.signal,
      onProgress: (nextProgress) => { progress = { ...nextProgress }; }
    })
      .then((result) => {
        status = 'COMPLETED';
        isRunning = false;
        progress.matchId = result.matchId;
      })
      .catch((error) => {
        isRunning = false;
        status = error.message === 'Replay cancelled' ? 'STOPPED' : 'ERROR';
        errorMessage = status === 'ERROR' ? error.message : null;
        if (status === 'ERROR') console.error('[Live replay] Execution error:', error);
      })
      .finally(() => { activeReplayPromise = null; });
  } catch (error) {
    isRunning = false;
    status = 'ERROR';
    errorMessage = error.message;
    throw error;
  }

  return { status: 'started', matchId: match.id };
}

export async function stopReplay() {
  if (!isRunning) return;
  abortController?.abort();
  await activeReplayPromise?.catch(() => {});
}
