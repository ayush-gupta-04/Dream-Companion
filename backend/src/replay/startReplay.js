import path from 'node:path';
import { config } from '../config/index.js';
import { prisma } from '../db/prisma.js';
import { MatchStateCache } from '../modules/match-intelligence/state/matchStateCache.js';
import { createTimelineService } from '../modules/timeline/timelineService.js';
import { replayCricsheetFile } from './replayService.js';

const filePath = process.argv[2] || config.replay.filePath;
if (!filePath) {
  throw new Error('Provide a Cricsheet JSON file path or set REPLAY_FILE.');
}

const noOpSocketServer = { to: () => ({ emit: () => {} }) };
const noOpCache = new MatchStateCache({ set: async () => {} });
const timelineService = createTimelineService({ prisma });
const sourceMatchId = path.basename(filePath, path.extname(filePath));

await replayCricsheetFile({
  filePath,
  sourceMatchId,
  intervalMs: config.replay.deliveryIntervalMs,
  prisma,
  stateCache: noOpCache,
  io: noOpSocketServer,
  timelineService
});

await prisma.$disconnect();
