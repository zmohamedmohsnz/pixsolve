// ─── Import Modules ─────────────────────────────────────────────────────────────

import app from './app.js';
import config from './config/env.js';
import connectToDB from './config/database.js';
import logger from './config/logger.js';

let server;
let isShuttingDown = false;

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

  process.exit(1);
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

  // stop process immediately if server is not listening
  if (!server?.listening) {
    return process.exit(1);
  }

  // if server is listening, stop accepting new connections
  // and wait for existing connections to finish before terminating.
  server.close(() => { process.exit(1); });

  // if the exist connections lasting longer 
  // than 10 seconds, terminate the process.
  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();
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