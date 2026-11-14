import { createServer } from 'node:http';
import path from 'node:path';
import { createClient } from 'redis';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { prisma } from './db/prisma.js';
import { MatchStateCache } from './modules/match-intelligence/state/matchStateCache.js';
import { createTimelineService } from './modules/timeline/timelineService.js';
import { replayCricsheetFile } from './replay/replayService.js';
import { createSocketServer } from './sockets/socketServer.js';

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
const app = createApp({ stateCache, timelineService });
const server = createServer(app);
const io = createSocketServer(server, config.frontendUrl);

server.listen(config.port, () => {
  console.log(`[API Server] Running on http://localhost:${config.port} (env: ${config.nodeEnv})`);
  console.log(`[API Server] Health check available at http://localhost:${config.port}/health`);
});

if (config.replay.filePath) {
  const sourceMatchId = path.basename(config.replay.filePath, path.extname(config.replay.filePath));
  replayCricsheetFile({
    filePath: config.replay.filePath,
    sourceMatchId,
    intervalMs: config.replay.deliveryIntervalMs,
    prisma,
    stateCache,
    io,
    timelineService
  }).catch((error) => {
    console.error('[Replay] Failed:', error);
    process.exitCode = 1;
  });
}

// Graceful shutdown handling
const shutdown = () => {
  console.log('\n[API Server] Shutting down gracefully...');
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
