import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import healthRoutes from './routes/healthRoutes.js';
import { createMatchRoutes } from './routes/matchRoutes.js';
import { createAnalyticsRoutes } from './routes/analyticsRoutes.js';
import { createAskMatchRoutes } from './routes/askMatchRoutes.js';
import { prisma } from './db/prisma.js';
import { createAskMatchService } from './modules/ai/askMatchService.js';
import { createOpenAiAskClient } from './modules/ai/openAiAskClient.js';
import { createOpenAiRecapClient } from './modules/ai/openAiRecapClient.js';
import { createRecapService } from './modules/summaries/recapService.js';
import { createRecapRoutes } from './routes/recapRoutes.js';
import { createTimelineService } from './modules/timeline/timelineService.js';
import { createTimelineRoutes } from './routes/timelineRoutes.js';
import { createEventSearchService } from './modules/timeline/eventSearchService.js';
import { createEventSearchRoutes } from './routes/eventSearchRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp({
  stateCache,
  askMatchService,
  recapService,
  timelineService,
  eventSearchService,
  prismaClient = prisma
} = {}) {
  const app = express();

  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true
    })
  );
  app.use(express.json());

  app.use('/health', healthRoutes);
  app.use('/api', healthRoutes);
  app.use('/api', createMatchRoutes({ stateCache, prismaClient }));
  app.use('/api', createAnalyticsRoutes(prismaClient));
  app.use(
    '/api',
    createRecapRoutes(
      recapService ??
        createRecapService({
          prisma: prismaClient,
          aiClient: createOpenAiRecapClient(config.openai)
        })
    )
  );
  app.use(
    '/api',
    createTimelineRoutes(timelineService ?? createTimelineService({ prisma: prismaClient }))
  );
  app.use(
    '/api',
    createEventSearchRoutes(
      eventSearchService ?? createEventSearchService({ prisma: prismaClient })
    )
  );
  app.use(
    '/api',
    createAskMatchRoutes(
      askMatchService ??
        createAskMatchService({
          prisma: prismaClient,
          aiClient: createOpenAiAskClient(config.openai)
        })
    )
  );

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
