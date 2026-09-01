// ─── Import Modules ─────────────────────────────────────────────────────────────

import app from './app.js';

// ─── Start a Server ─────────────────────────────────────────────────────────────

const port = 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});