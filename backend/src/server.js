import { createServer } from 'node:http';
import { createClient } from 'redis';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { prisma } from './db/prisma.js';
import { MatchStateCache } from './modules/match-intelligence/state/matchStateCache.js';
import { createTimelineService } from './modules/timeline/timelineService.js';
import { bootstrapHistoricalArchive } from './replay/historicalArchiveService.js';
import { LiveReplayManager } from './replay/liveReplayManager.js';
import { createSocketServer } from './sockets/socketServer.js';
import { createClerkAuth } from './auth/clerkAuth.js';

const redisClient = createClient({
  url: config.redis.url,
  socket: { reconnectStrategy: false }
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

const archive = await bootstrapHistoricalArchive({
  prisma,
  stateCache,
  timelineService,
  dataDirectory: config.replay.dataDirectory,
  liveFileName: config.replay.liveFileName
});
liveReplayManager.registerLiveMatch({
  matchId: archive.liveMatchId,
  liveFilePath: archive.liveFilePath
});
console.log(
  `[Archive] Ready: ${archive.historicalMatchesSeeded} seeded, ${archive.historicalMatchesSkipped} unchanged, 1 live simulation.`
);

const auth = createClerkAuth({ clerk: config.clerk, nodeEnv: config.nodeEnv });
const app = createApp({ stateCache, timelineService, liveReplayManager, auth });
const server = createServer(app);
const io = createSocketServer(server, config.frontendUrl, {
  authenticate: auth.authenticateSocket
});
liveReplayManager.io = io;

server.listen(config.port, () => {
  console.log(`[API Server] Running on http://localhost:${config.port} (env: ${config.nodeEnv})`);
  console.log(`[API Server] Health check available at http://localhost:${config.port}/health`);
  console.log('[Live replay] Ready when a fan opens the designated live match.');
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
