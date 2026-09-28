// ─── Import Modules ─────────────────────────────────────────────────────────────

import mongoose from 'mongoose';
import app from './app.js';
import config from './config/env.js';
import connectToDB from './config/database.js';
import logger from './config/logger.js';
import { shutdownImageProcessingQueue } from './queues/image-processing-queue.js';

let server;
let isShuttingDown = false;

// ─── Shutdown flow ──────────────────────────────────────────────────────────────

const shutdown = async (reason, requestedExitCode = 0) => {
  if (isShuttingDown) return;

  isShuttingDown = true;

  logger.info(
    { event: 'apiShutdownStarted', reason },
    'API shutdown started'
  );

  const forceExitTimer = setTimeout(() => {
    logger.fatal(
      { event: 'apiShutdownTimedOut', reason },
      'API shutdown timed out'
    );

    process.exit(1);
  }, 10_000).unref();

  try {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await shutdownImageProcessingQueue();
    await mongoose.disconnect();

    logger.info(
      { event: 'apiShutdownSucceeded', reason },
      'API shutdown succeeded'
    );

    process.exit(requestedExitCode);
  } catch (error) {
    logger.error(
      { event: 'apiShutdownFailed', reason, error },
      'API shutdown failed'
    );

    process.exit(1);
  } finally {
    clearTimeout(forceExitTimer);
  }
};


// ─── Handle signals ─────────────────────────────────────────────────────────────

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// ─── Handle uncaught exceptions ─────────────────────────────────────────────────

// these are the errors that happened in sync code
// wether before express start or inside a callback.
//
// we terminate because they may leave app in inconsistent state.
process.on('uncaughtException', (err) => {
  logger.fatal(
    { event: 'uncaughtException', err },
    'Uncaught Exception Occurred'
  );

  void shutdown('uncaughtException', 1);
});

// ─── Handle Unhandled Promise Rejection ─────────────────────────────────────────

// these errors that happen when rejected promises have no rejection handler.
process.on('unhandledRejection', (reason) => {
  // this line prevents the shutdown procedure from starting more than once
  // as if two promise rejects happen at the same time, so the handler could
  // log multiple times, call `server.close()` more than once.
  // it effectively means: “If shutdown has already started, do nothing.”
  if (isShuttingDown) return;

  isShuttingDown = true;

  // we normalize the non-error to an error to pass an error object
  // to pino logger as it handled error objects much better than strings
  const err = 
    reason instanceof Error
    ? reason
    : new Error(`Promise rejected with a non-Error value: ${String(reason)}`);

  logger.fatal(
    { event: 'unhandledRejection', err },
    'Unhandled promise rejection occurred'
  );

  void shutdown('unhandledRejection', 1);
});

// ─── Connect Database & Start a Server ──────────────────────────────────────────

const startServer = async () => {
  try {
    await connectToDB(config.dbUri);

    return app.listen(config.port, () => {
      logger.info(
        { server: { port: config.port, env: config.nodeEnv } },
        'Server started'
      );
    });
    
  } catch (err) {
    logger.fatal(
      { error: { name: err.name, code: err.code } },
      'Database connection failed'
    );

    process.exitCode = 1;
    return undefined;
  }
};

server = await startServer();