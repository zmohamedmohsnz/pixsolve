// ─── Import Modules ─────────────────────────────────────────────────────────────

import app from './app.js';
import config from './config/env.js';
import connectToDB from './config/database.js';
import logger from './config/logger.js';

// ─── Connect Database ───────────────────────────────────────────────────────────

try {
  await connectToDB(config.dbUri);
} catch (err) {
  logger.fatal(
    { error: { name: err.name, code: err.code } },
    'Database connection failed'
  );

  // removing this line makes server starts regardless connection status
  process.exitCode = 1; 
}

// ─── Start a Server ─────────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  logger.info(
    { server: { port: config.port, env: config.nodeEnv } },
    'Server started'
  );
});