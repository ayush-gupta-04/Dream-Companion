import { createServer } from 'node:http';
import { createClient } from 'redis';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { prisma } from './db/prisma.js';
import { MatchStateCache } from './modules/match-intelligence/state/matchStateCache.js';
import { createTimelineService } from './modules/timeline/timelineService.js';
import {
  bootstrapLiveMatch,
  seedHistoricalArchive
} from './replay/historicalArchiveService.js';
import { LiveReplayManager } from './replay/liveReplayManager.js';
import { createSocketServer } from './sockets/socketServer.js';
import { createClerkAuth } from './auth/clerkAuth.js';

const redisClient = createClient({
  url: config.redis.url,
  socket: { reconnectStrategy: false, connectTimeout: 3000 }
});
redisClient.on('error', (error) => console.error('[Redis] Connection error:', error.message));
await redisClient
  .connect()
  .catch((error) => console.warn('[Redis] Running without cache:', error.message));

const stateCache = new MatchStateCache(redisClient);
const timelineService = createTimelineService({ prisma });
const liveReplayManager = new LiveReplayManager({
  prisma,
  stateCache,
  io: null,
  timelineService,
  liveSourceMatchId: config.replay.liveFileName.replace(/\.json$/i, ''),
  defaultIntervalMs: config.replay.deliveryIntervalMs
});

const auth = createClerkAuth({ clerk: config.clerk, nodeEnv: config.nodeEnv });
const app = createApp({ stateCache, timelineService, liveReplayManager, auth });
const server = createServer(app);
const io = createSocketServer(server, config.frontendUrl, {
  authenticate: auth.authenticateSocket
});
liveReplayManager.io = io;

server.listen(config.port, '0.0.0.0', async () => {
  console.log(`[API Server] Running on http://0.0.0.0:${config.port} (env: ${config.nodeEnv})`);
  console.log(`[API Server] Health check available at http://0.0.0.0:${config.port}/health`);

  try {
    const liveArchive = await bootstrapLiveMatch({
      prisma,
      stateCache,
      dataDirectory: config.replay.dataDirectory,
      liveFileName: config.replay.liveFileName
    });
    liveReplayManager.registerLiveMatch({
      matchId: liveArchive.liveMatchId,
      liveFilePath: liveArchive.liveFilePath
    });
    console.log(`[Archive] Live simulation match ready: ${liveArchive.liveMatchId}`);
    console.log('[Live replay] Ready when a fan opens the designated live match.');

    seedHistoricalArchive({
      prisma,
      stateCache,
      timelineService,
      dataDirectory: config.replay.dataDirectory,
      liveFileName: config.replay.liveFileName,
      limit: config.replay.seedLimit
    }).catch((error) => {
      console.error('[Archive] Background seeding encountered an error:', error.message);
    });
  } catch (error) {
    console.error('[Archive] Failed to bootstrap live simulation:', error.message);
  }
});

// Graceful shutdown handling
const shutdown = () => {
  console.log('\n[API Server] Shutting down gracefully...');
  liveReplayManager.stop();
  io.close();
  server.close(async () => {
    if (redisClient.isOpen) await redisClient.quit();
    await prisma.$disconnect();
    console.log('[API Server] Closed remaining connections.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
