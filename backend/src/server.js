import { createServer } from 'node:http';
import app from './app.js';
import { config } from './config/index.js';
import { prisma } from './db/prisma.js';
import { redisClient } from './db/redis.js';
import {
  bootstrapLiveMatch,
  seedHistoricalArchive
} from './replay/historicalArchiveService.js';
import { registerLiveMatch, stopReplay } from './replay/liveReplayManager.js';
import { io, attachSocketServer } from './sockets/socketServer.js';

await redisClient
  .connect()
  .catch((error) => console.warn('[Redis] Running without cache:', error.message));

const server = createServer(app);
attachSocketServer(server);
const archiveAbortController = new AbortController();
let archiveTask = Promise.resolve();
let shuttingDown = false;

async function loadArchive() {
  try {
    const liveArchive = await bootstrapLiveMatch();
    if (archiveAbortController.signal.aborted) return;
    registerLiveMatch({
      matchId: liveArchive.liveMatchId,
      liveFilePath: liveArchive.liveFilePath
    });
    console.log(`[Archive] Live simulation match ready: ${liveArchive.liveMatchId}`);
    console.log('[Live replay] Ready when a fan opens the designated live match.');

    try {
      await seedHistoricalArchive({ signal: archiveAbortController.signal });
    } catch (error) {
      console.error('[Archive] Background seeding encountered an error:', error.message);
    }
  } catch (error) {
    console.error('[Archive] Failed to bootstrap live simulation:', error.message);
  }
}

server.listen(config.port, '0.0.0.0', () => {
  console.log(`[API Server] Running on http://0.0.0.0:${config.port} (env: ${config.nodeEnv})`);
  console.log(`[API Server] Health check available at http://0.0.0.0:${config.port}/health`);
  if (!shuttingDown) archiveTask = loadArchive();
});

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[API Server] Shutting down gracefully...');
  archiveAbortController.abort();

  const tasks = await Promise.allSettled([stopReplay(), io.close(), archiveTask]);
  const connections = await Promise.allSettled([
    redisClient.isOpen ? redisClient.quit() : Promise.resolve(),
    prisma.$disconnect()
  ]);
  const failures = [...tasks, ...connections].filter((result) => result.status === 'rejected');
  for (const failure of failures) {
    console.error('[API Server] Shutdown error:', failure.reason);
  }
  console.log('[API Server] Closed remaining connections.');
  process.exitCode = failures.length > 0 ? 1 : 0;
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
