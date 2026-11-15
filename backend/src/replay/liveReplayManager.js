import path from 'node:path';
import { config } from '../config/index.js';
import { replayCricsheetFile } from './replayService.js';
import { clearMatchSimulationData } from './matchSimulationDataService.js';

let liveFilePath = '';
let liveSourceMatchId = path.parse(config.replay.liveFileName).name;
let liveMatchId = null;
let abortController = null;
let activeReplayPromise = null;

function notFound(message) {
  return Object.assign(new Error(message), { statusCode: 404 });
}

export function registerLiveMatch({ matchId, liveFilePath: filePath }) {
  liveMatchId = matchId;
  if (filePath) {
    liveFilePath = filePath;
    liveSourceMatchId = path.parse(filePath).name;
  }
}

export function isLiveMatchId(matchId) {
  return Boolean(matchId && liveMatchId === matchId);
}

export async function startForMatch(matchId) {
  if (!isLiveMatchId(matchId)) {
    throw notFound('This match is not configured for live simulation.');
  }
  if (activeReplayPromise) {
    return { status: 'running', matchId };
  }
  if (!liveFilePath) {
    const error = new Error('The configured live replay file is unavailable.');
    error.statusCode = 503;
    throw error;
  }

  const controller = new AbortController();
  abortController = controller;

  const reset = clearMatchSimulationData({ matchId, status: 'LIVE' });

  activeReplayPromise = reset
    .then(() => {
      controller.signal.throwIfAborted();
      return replayCricsheetFile({
        filePath: liveFilePath,
        sourceMatchId: liveSourceMatchId,
        intervalMs: config.replay.deliveryIntervalMs,
        signal: controller.signal
      });
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        console.error('[Live replay] Execution error:', error);
      }
    })
    .finally(() => {
      activeReplayPromise = null;
      abortController = null;
    });

  await reset;
  return { status: 'started', matchId };
}

export async function stopReplay() {
  abortController?.abort();
  await activeReplayPromise;
}
