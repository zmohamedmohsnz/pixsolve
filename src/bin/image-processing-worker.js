// Job : this file focuses on the worker lifecycle. It answers
// how does this Node.js worker start, run, and shutdown.

import mongoose from 'mongoose';
import config from '../config/env.js';
import connectToDB from '../config/database.js';
import log from '../config/logger.js';
import createImageProcessingWorker from '../workers/image-processing-worker.js';
import { createWorkerRedisConnection } from '../config/redis.js';

let worker;
let redisConnection;
let isShuttingDown = false;

// create a safe object for logging
// instead of logging the whole error. 
const createSafeError = error => ({
  // JS lets you throw literally anything like strings, numbers
  // so we check that the error is a normal JS `Error`
  name: error instanceof Error ? error.name : 'Error',
  code: typeof error?.code === 'string' ? error.code : undefined
});

// close worker, redis, mongoose.
const closeResources = async (worker, redisConnection) => {
  // this method does graceful shutdown. Basically,
  // stop taking new jobs, finish the active ones, close the worker
  if (worker) await worker.close();

  // this method does graceful shutdown. it's better
  // than just suddenly killing the TCP connection.
  if (redisConnection?.status !== 'end') await redisConnection.quit();

  // close the database connection gracefully.
  await mongoose.disconnect();
};

const shutdown = async (worker, redisConnection, reason, requestedExitCode = 0) => {
  // this prevents shutdown logic from running more
  // than once even you run shutdown() twice.
  if (isShuttingDown) return;
  isShuttingDown = true;

  let exitCode = requestedExitCode;

  log.info(
    {
      event: 'imageProcessingWorkerShutdownStarted',
      reason
    },
    'Image processing worker shutdown started'
  );

  try {
    await closeResources(worker, redisConnection);

    log.info(
      {
        event: 'imageProcessingWorkerShutdownSucceed',
        reason
      },
      'Image processing worker shutdown succeed'
    );

  } catch (error) {
    exitCode = 1;

    log.error(
      {
        event: 'imageProcessingWorkerShutdownFailed',
        reason,
        failure: createSafeError(error)
      },
      'Image processing worker shutdown failed'
    );
  }

  process.exit(exitCode);
};

// we use `process.once` and not `process.on` because
// we want shutdown run only once for shutdown signals.
// so pressing `Ctrl + C` multiple times doesn't call shutdown() multiple times.

// `SIGINT` means signal interrupt.
// usually happen when you press Ctrl + c in terminal.
process.once('SIGINT', () => {
  void shutdown(worker, redisConnection, 'SIGINT');
});

// `SIGTERM` means termination signal.
// usually send by Docker, Kubernetes, deployment platforms, etc.
process.once('SIGTERM', () => {
  void shutdown(worker, redisConnection, 'SIGTERM');
});

process.once('uncaughtException', error => {
  log.fatal(
    {
      event: 'uncaughtException',
      failure: createSafeError(error)
    },
    'Uncaught exception in image processing worker'
  );

  void shutdown(worker, redisConnection, 'uncaughtException', 1);
});

process.once('unhandledRejection', reason => {
  const error = reason instanceof Error ? reason : new Error('Promise rejected with a non-Error value');

  log.fatal(
    {
      event: 'unhandledRejection',
      failure: createSafeError(error)
    },
    'Unhandled promise rejection in image processing worker'
  );

  void shutdown(worker, redisConnection, 'unhandledRejection', 1);
});

const startWorker = async () => {
  try {
    // connect to db and redis
    await connectToDB(config.dbUri);
    redisConnection = createWorkerRedisConnection();

    // start the worker
    worker = createImageProcessingWorker({redisConnection});

    // wait until the worker is actually ready
    await worker.waitUntilReady();

    log.info(
      {
        event: 'imageProcessingWorkerStarted',
        queue: worker.name,
        concurrency: worker.opts.concurrency
      },
      'image processing worker started'
    );
  } catch (error) {
    log.fatal(
      {
        event: 'imageProcessingWorkerStartupFailed',
        failure: createSafeError(error)
      },
      'Image processing worker failed to start'
    );

    try {
      await closeResources(worker, redisConnection);
    } catch (error) {
      log.error(
        {
          event: 'imageProcessingWorkerStartupCleanupFailed',
          failure: createSafeError(error)
        },
        'Worker startup cleanup failed'
      );
    }

    process.exitCode = 1;      
  }
};

await startWorker();
