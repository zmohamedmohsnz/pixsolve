import { Worker } from 'bullmq';
import logger from '../config/logger.js';
import processImageJob from './image-job-processor.js';

const IMAGE_PROCESSING_QUEUE_NAME = 'image-processing';

// create a safe object for logging
// instead of logging the whole error. 
const createSafeWorkerError = error => ({
  name: error instanceof Error ? error.name : 'Error',
  code: typeof error?.code === 'string' ? error.code : undefined
});

const createImageProcessingWorker = ({
  redisConnection,
  imageJobProcessor = processImageJob,
  log = logger
} = {}) => {
  const worker = new Worker(
    // name of the BullMQ queue that worker
    // should listen to and pick jobs from it.
    IMAGE_PROCESSING_QUEUE_NAME,

    // function that handles incoming jobs.
    // internally, BullMQ fetches a job and pass it to processor.
    imageJobProcessor,

    {
      connection: redisConnection,
      // means BullMQ worker processes at most one job at the same time.
      // it depends on your server capability.
      concurrency: 1
    }
  );

  // whenever the worker itself encounters an error, run this callback.
  // for example: Redis connection problem, internal BullMQ problem, network problem.
  // it doesn't run for errors coming from the processor.
  worker.on('error', error => {
    log.error(
      {
        event: 'imageProcessingWorkerError',
        failure: createSafeWorkerError(error)
      },
      'Image processing worker error'
    );
  });

  return worker;
};

export default createImageProcessingWorker;