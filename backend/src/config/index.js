import dotenv from 'dotenv';
import path from 'node:path';
import { existsSync } from 'node:fs';

dotenv.config();

const backendEnvPath = path.resolve(process.cwd(), 'backend', '.env');
if (existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

const thinkingLevels = new Set(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']);

function geminiThinkingLevel(value) {
  const normalized = value?.trim().toUpperCase();
  return thinkingLevels.has(normalized) ? normalized : 'MINIMAL';
}

function commaSeparatedValues(value, fallback = []) {
  const parsed = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  clerk: {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
    secretKey: process.env.CLERK_SECRET_KEY || '',
    authorizedParties: commaSeparatedValues(process.env.CLERK_AUTHORIZED_PARTIES, [
      process.env.FRONTEND_URL || 'http://localhost:5173'
    ])
  },
  databaseUrl: process.env.DATABASE_URL || '',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    url:
      process.env.REDIS_URL ||
      `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`
  },
  replay: {
    dataDirectory: process.env.CRICSHEET_DATA_DIR || 't20s_male_json',
    // REPLAY_FILE is retained as a temporary local-config fallback so existing
    // development environments can move to LIVE_REPLAY_FILE without breaking.
    liveFileName: path.basename(
      process.env.LIVE_REPLAY_FILE || process.env.REPLAY_FILE || '1001349.json'
    ),
    deliveryIntervalMs: parseInt(process.env.REPLAY_INTERVAL_MS || '1000', 10)
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10),
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '2000', 10),
    thinkingLevel: geminiThinkingLevel(process.env.GEMINI_THINKING_LEVEL)
  }
};
