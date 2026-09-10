import IORedis from 'ioredis';
import config from './env.js';

export const createRedisConnection = ({
  maxRetriesPerRequest,
  enableOfflineQueue = true
}) => {
  return new IORedis(config.redisUrl, {
    // how many times ioredis retires a Redis command before throwing the error
    maxRetriesPerRequest,
    // `true` means when Redis is unavailable, ioredis keeps
    // commands in memory and sends them once Redis reconnects 
    enableOfflineQueue
  });
};

// so API rejects queue commands when Redis is down
// instead of make HTTP requests waiting indefinitely.
export const createProducerRedisConnection = () => {
  return createRedisConnection({
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });
};

// worker is a long-running process so it's okay
// to keep retrying until Redis come back
export const createWorkerRedisConnection = () => {
  return createRedisConnection({
    maxRetriesPerRequest: null,
  });
};