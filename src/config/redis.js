// ─── Import Modules ─────────────────────────────────────────────────────────────

import Redis from 'ioredis';
import config from './env.js';

// ─── Connect to Redis ───────────────────────────────────────────────────────────

export const createRedisConnection = ({ maxRetriesPerRequest, enableOfflineQueue = true }) => {
  return new Redis(config.redisUrl,
    {
      // how many times `ioredis` retries a command before giving up and throwing an error.
      maxRetriesPerRequest,

      // when `true`, if Redis is unavailable, `ioredis` keeps
      // commands in memory and sends them once Redis reconnects.
      enableOfflineQueue
    });
};

// ─── Connections Factory ────────────────────────────────────────────────────────

// worker is a long-running process so it's
// okay to keep retrying until Redis come back.
export const createWorkerRedisConnection = () => {
  return createRedisConnection({ maxRetriesPerRequest: null });
};

// API commands should fail quickly when Redis is unavailable
// to avoid making HTTP requests wait too long.
export const createApiRedisConnection = () => {
  return createRedisConnection({ maxRetriesPerRequest: 1, enableOfflineQueue: false });
};