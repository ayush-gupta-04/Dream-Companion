import { createClient } from 'redis';
import { config } from '../config/index.js';

export const redisClient = createClient({
  url: config.redis.url,
  socket: { reconnectStrategy: false, connectTimeout: 3000 }
});

redisClient.on('error', (error) => console.error('[Redis] Connection error:', error.message));
