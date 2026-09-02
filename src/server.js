// ─── Import Modules ─────────────────────────────────────────────────────────────

import app from './app.js';
import config from './config/env.js';
import connectToDB from './config/database.js';
import logger from './config/logger.js';

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

const server = await startServer();