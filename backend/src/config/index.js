import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    url:
      process.env.REDIS_URL ||
      `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`
  },
  replay: {
    filePath: process.env.REPLAY_FILE || '',
    deliveryIntervalMs: parseInt(process.env.REPLAY_INTERVAL_MS || '1000', 10)
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || '15000', 10),
    maxOutputTokens: parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || '500', 10)
  }
};
