import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import healthRoutes from './routes/healthRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import recapRoutes from './routes/recapRoutes.js';
import matchQueryRoutes from './routes/matchQueryRoutes.js';
import timelineRoutes from './routes/timelineRoutes.js';
import eventSearchRoutes from './routes/eventSearchRoutes.js';
import liveSimulationRoutes from './routes/liveSimulationRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initializeAuth, requireAuthenticated } from './auth/clerkAuth.js';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const matchCardImageDirectory = path.join(backendDirectory, 'public');
const app = express();

app.use(initializeAuth);
app.use(cors());
app.use(express.json());
app.use('/match-card-images', express.static(matchCardImageDirectory, { maxAge: '1h' }));

app.use('/health', healthRoutes);
app.use('/api', healthRoutes);
app.use('/api', requireAuthenticated);
app.use('/api', matchRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', recapRoutes);
app.use('/api', timelineRoutes);
app.use('/api', eventSearchRoutes);
app.use('/api', matchQueryRoutes);
app.use('/api', liveSimulationRoutes);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.use(errorHandler);

export default app;
