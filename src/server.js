// ─── Import Modules ─────────────────────────────────────────────────────────────

import app from './app.js';
import config from './config/env.js';
import connectToDB from './config/database.js';

// ─── Connect Database ───────────────────────────────────────────────────────────

try {
  await connectToDB(config.dbUri);
} catch (err) {
  // logger.fatal({ err }, 'Database connection failed');
  console.error('Database connection failed');

  // removing this line makes server starts regardless connection status
  process.exit(1); 
}

// ─── Start a Server ─────────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  console.log(`App running on port ${config.port}...`);
});