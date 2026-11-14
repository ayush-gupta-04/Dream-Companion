import path from 'node:path';
import { replayCricsheetFile } from './replayService.js';
import { clearMatchSimulationData } from './matchSimulationDataService.js';

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

/** Controls the one configured simulated-live match for this API process. */
export class LiveReplayManager {
  constructor({
    prisma,
    stateCache,
    io,
    timelineService,
    liveFilePath = '',
    liveSourceMatchId = '',
    defaultIntervalMs = 1000
  }) {
    this.prisma = prisma;
    this.stateCache = stateCache;
    this.io = io;
    this.timelineService = timelineService;
    this.liveFilePath = liveFilePath;
    this.liveSourceMatchId =
      liveSourceMatchId || path.basename(liveFilePath, path.extname(liveFilePath));
    this.defaultIntervalMs = defaultIntervalMs;
    this.liveMatchId = null;
    this.isRunning = false;
    this.status = 'IDLE';
    this.error = null;
    this.abortController = null;
    this.activeReplayPromise = null;
    this.progress = {
      matchId: null,
      matchName: null,
      inningsNumber: null,
      ballLabel: null,
      processedDeliveries: 0,
      totalDeliveries: 0
    };
  }

  registerLiveMatch({ matchId, liveFilePath }) {
    this.liveMatchId = matchId;
    if (liveFilePath) {
      this.liveFilePath = liveFilePath;
      this.liveSourceMatchId = path.basename(liveFilePath, path.extname(liveFilePath));
    }
  }

  isLiveMatchId(matchId) {
    return Boolean(matchId && this.liveMatchId === matchId);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      status: this.status,
      error: this.error,
      progress: { ...this.progress }
    };
  }

  async requireLiveMatch(matchId) {
    if (this.isLiveMatchId(matchId)) return { id: matchId };

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, source: true, sourceMatchId: true }
    });
    if (!match) throw notFound('Match not found.');
    if (match.source !== 'cricsheet' || match.sourceMatchId !== this.liveSourceMatchId) {
      throw notFound('This match is not configured for live simulation.');
    }

    this.liveMatchId = match.id;
    return match;
  }

  async startForMatch(matchId) {
    const match = await this.requireLiveMatch(matchId);
    if (this.isRunning) {
      return { status: 'running', matchId: match.id };
    }
    if (!this.liveFilePath) {
      const error = new Error('The configured live replay file is unavailable.');
      error.statusCode = 503;
      throw error;
    }

    this.isRunning = true;
    this.status = 'STARTING';
    this.error = null;
    this.progress = {
      matchId: match.id,
      matchName: null,
      inningsNumber: null,
      ballLabel: null,
      processedDeliveries: 0,
      totalDeliveries: 0
    };
    this.abortController = new AbortController();

    try {
      await clearMatchSimulationData({
        prisma: this.prisma,
        stateCache: this.stateCache,
        matchId: match.id,
        status: 'LIVE'
      });

      this.status = 'RUNNING';
      this.activeReplayPromise = replayCricsheetFile({
        filePath: this.liveFilePath,
        sourceMatchId: this.liveSourceMatchId,
        intervalMs: this.defaultIntervalMs,
        prisma: this.prisma,
        stateCache: this.stateCache,
        io: this.io,
        timelineService: this.timelineService,
        signal: this.abortController.signal,
        onProgress: (progress) => {
          this.progress = { ...progress };
        }
      })
        .then((result) => {
          this.status = 'COMPLETED';
          this.isRunning = false;
          this.progress.matchId = result.matchId;
        })
        .catch((error) => {
          this.isRunning = false;
          this.status = error.message === 'Replay cancelled' ? 'STOPPED' : 'ERROR';
          this.error = this.status === 'ERROR' ? error.message : null;
          if (this.status === 'ERROR') console.error('[Live replay] Execution error:', error);
        })
        .finally(() => {
          this.activeReplayPromise = null;
        });
    } catch (error) {
      this.isRunning = false;
      this.status = 'ERROR';
      this.error = error.message;
      throw error;
    }

    return { status: 'started', matchId: match.id };
  }

  async stop() {
    if (!this.isRunning) return;
    this.abortController?.abort();
    await this.activeReplayPromise?.catch(() => {});
  }
}
