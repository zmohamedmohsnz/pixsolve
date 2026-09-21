// ─── Import Modules ─────────────────────────────────────────────────────────────

import { Queue } from 'bullmq';
import { createApiRedisConnection } from '../config/redis.js';

const redisConnection = createApiRedisConnection();

// ─── Create Queue ───────────────────────────────────────────────────────────────

export const imageProcessingQueueName = 'image-processing';

export const defaultJobOptions = {
  // max number of processing attempts if fails (1 initial attempt + 2 retries)
  attempts: 3,

  // this is a delay time before retrying when processing fails.
  backoff: {
    // increase the delay time exponentially after each failed attempt.
    type: 'exponential',
    delay: 1000 // milliseconds
  },

  // keep successful and failed jobs temporarily for debugging/history.
  removeOnComplete: {
    age: 24 * 60 * 60, // keep each completed job for 24h.
    count: 100 // keep at most 100 completed jobs.
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // 7 days
    count: 500 // at most 500
  },
};

export const imageProcessingQueue = new Queue(
  imageProcessingQueueName,
  {
    connection: redisConnection,
    
    // these options are automatically applied to every job unless you override them
    defaultJobOptions
  }
); 

// ─── Add Job to Queue ───────────────────────────────────────────────────────────

export const imageProcessingJobName = 'process-image';

export const enqueueImageProcessingJob = jobDBId => {
  return imageProcessingQueue.add(
    imageProcessingJobName,

    // data that will be passed to the processor
    { jobDBId: jobDBId.toString() },

    // sets a custom BullMQ job ID. BullMQ can generates it automatically.
    // we do this, because may a bug make enqueue request repeat, so this creates
    // the same job multiple times with different ID, but with custom ID, BullMQ
    // won't add a job with an ID that another job in the queue has.
    { jobId: `db-job-${jobDBId.toString()}` }
  );
};

// ─── Terminate Queue ────────────────────────────────────────────────────────────

export const shutdownImageProcessingQueue = async () => {
  // it means I'm finished using this BullMQ Queue instance.
  // Clean up the resources/connections it owns. it doesn't
  // delete the queue or its jobs from Redis.
  await imageProcessingQueue.close();

  if (redisConnection.status === 'ready') {
    await redisConnection.quit(); // graceful shutdown
    return;
  }

  // Redis isn't ready, so just close the client connection locally
  // which means tells the local ioredis client: Stop trying
  // to connect to Redis and close your connection.
  redisConnection.disconnect();
};
