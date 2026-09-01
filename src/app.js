// ─── Import Modules ─────────────────────────────────────────────────────────────

import express from 'express';
import helmet from 'helmet';

// ─── Create Express App ─────────────────────────────────────────────────────────

const app = express();

// ─── GLOBAL MIDDLEWARE ──────────────────────────────────────────────────────────

// returns some response headers that mitigate browser-based attacks.
app.use(helmet());

// parses the JSON bodies.
app.use(express.json({ limit: '10kb' }));

export default app;