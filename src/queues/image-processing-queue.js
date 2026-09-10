import { Queue } from 'bullmq';
import { createProducerRedisConnection } from '../config/redis.js';

export const IMAGE_PROCESSING_QUEUE_NAME = 'image-processing';
export const IMAGE_PROCESSING_JOB_NAME = 'process-image';

export const IMAGE_PROCESSING_JOB_OPTIONS = {
  // if job fails, the initial attempt plus up to two retries.
  attempts: 3,

  // this is a waiting time before retrying.
  backoff: {
    // 'exponential' means waiting time grows instead of staying fixed.
    type: 'exponential',
    delay: 1000
  },

  // keep successful jobs temporarily for debugging/history.
  removeOnComplete: {
    age: 24 * 60 * 60, // keep each completed job for 24h.
    count: 100 // keep at most 100 completed jobs.
  },

  removeOnFail: {
    age: 7 * 24 * 60 * 60, // for 7 days
    count: 500 // at most 500
  },
};

const redisConnection = createProducerRedisConnection();

export const imageProcessingQueue = new Queue(
  IMAGE_PROCESSING_QUEUE_NAME,
  {
    // BullMQ uses Redis to store queue info and job info
    connection: redisConnection,
    // these are options automatically applied to every job unless you override
    defaultJobOptions: IMAGE_PROCESSING_JOB_OPTIONS
  }
);

export const enqueueImageProcessingJob = jobId => {
  return imageProcessingQueue.add(
    IMAGE_PROCESSING_JOB_NAME,
    { jobId: jobId.toString() }
  );
};

export const closeImageProcessingQueue = async () => {
  await imageProcessingQueue.close();
  await redisConnection.quit();
};