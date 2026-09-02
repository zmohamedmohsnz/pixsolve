// ─── Import Modules ─────────────────────────────────────────────────────────────

import app from './app.js';
import config from './config/env.js';

// ─── Start a Server ─────────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  console.log(`App running on port ${config.port}...`);
});