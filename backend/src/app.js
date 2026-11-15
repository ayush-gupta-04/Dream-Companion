import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import healthRoutes from './routes/healthRoutes.js';
import { createMatchRoutes } from './routes/matchRoutes.js';
import { createAnalyticsRoutes } from './routes/analyticsRoutes.js';
import { prisma } from './db/prisma.js';
import { createAskMatchService } from './modules/ai/askMatchService.js';
import { createGeminiMatchQueryClient } from './modules/ai/geminiMatchQueryClient.js';
import { createMatchQueryService } from './modules/ai/matchQueryService.js';
import { createRecapService } from './modules/summaries/recapService.js';
import { createRecapRoutes } from './routes/recapRoutes.js';
import { createMatchQueryRoutes } from './routes/matchQueryRoutes.js';
import { createTimelineService } from './modules/timeline/timelineService.js';
import { createTimelineRoutes } from './routes/timelineRoutes.js';
import { createEventSearchService } from './modules/timeline/eventSearchService.js';
import { createEventSearchRoutes } from './routes/eventSearchRoutes.js';
import { LiveReplayManager } from './replay/liveReplayManager.js';
import { createLiveSimulationRoutes } from './routes/liveSimulationRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createClerkAuth } from './auth/clerkAuth.js';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const matchCardImageDirectory = path.join(backendDirectory, 'public');

export function createApp({
  stateCache,
  askMatchService,
  recapService,
  matchQueryService,
  timelineService,
  eventSearchService,
  liveReplayManager,
  auth,
  io,
  prismaClient = prisma
} = {}) {
  const app = express();
  const activeAuth = auth ?? createClerkAuth({ clerk: config.clerk, nodeEnv: config.nodeEnv });

  app.use(activeAuth.initialize);
//   app.use(
//     cors({
//       origin: config.frontendUrl,
//       credentials: true
//     })
//   );
    app.use(cors()); // Allows all origins
  app.use(express.json());
  app.use('/match-card-images', express.static(matchCardImageDirectory, { maxAge: '1h' }));

  app.use('/health', healthRoutes);
  app.use('/api', healthRoutes);
  app.use('/api', activeAuth.requireAuthenticated);
  const activeTimelineService = timelineService ?? createTimelineService({ prisma: prismaClient });
  const activeLiveReplayManager =
    liveReplayManager ??
    new LiveReplayManager({
      prisma: prismaClient,
      stateCache,
      io: io ?? { to: () => ({ emit: () => {} }) },
      timelineService: activeTimelineService,
      liveSourceMatchId: config.replay.liveFileName.replace(/\.json$/i, ''),
      defaultIntervalMs: config.replay.deliveryIntervalMs
    });

  app.use(
    '/api',
    createMatchRoutes({ stateCache, prismaClient, liveReplayManager: activeLiveReplayManager }));
    
  app.use('/api', createAnalyticsRoutes(prismaClient));
  const queryAiClient = createGeminiMatchQueryClient(config.gemini);
  const activeRecapService =
    recapService ??
    createRecapService({
      prisma: prismaClient,
      narrate: queryAiClient?.narrateRecap
    });
  const activeAskMatchService =
    askMatchService ??
    createAskMatchService({
      prisma: prismaClient,
      narrate: queryAiClient?.narrateAnalysis
    });
  const activeMatchQueryService =
    matchQueryService ??
    createMatchQueryService({
      prisma: prismaClient,
      aiClient: queryAiClient,
      analysisService: activeAskMatchService,
      recapService: activeRecapService
    });
  app.use('/api', createRecapRoutes(activeRecapService));
  app.use('/api', createTimelineRoutes(activeTimelineService));
  app.use(
    '/api',
    createEventSearchRoutes(
      eventSearchService ?? createEventSearchService({ prisma: prismaClient })
    )
  );
  app.use('/api', createMatchQueryRoutes(activeMatchQueryService));

  app.use('/api', createLiveSimulationRoutes(activeLiveReplayManager));

  app.use((req, res) => {
    res.status(404).json({
      status: 'error',
      message: `Cannot ${req.method} ${req.originalUrl}`
    });
  });

  app.use(errorHandler);
  return app;
}

export default createApp();
