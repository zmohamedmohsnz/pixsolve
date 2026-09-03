// ─── Import Modules ─────────────────────────────────────────────────────────────

import express from 'express';
import helmet from 'helmet';
import errorHandler from './middleware/errorHandler.js';

// ─── Create Express App ─────────────────────────────────────────────────────────

const app = express();

// ─── GLOBAL MIDDLEWARE ──────────────────────────────────────────────────────────

// returns some response headers that mitigate browser-based attacks.
app.use(helmet());

// parses the JSON bodies.
app.use(express.json({ limit: '10kb' }));

// ─── ROUTES ─────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ─── Error Handler Middleware ───────────────────────────────────────────────────

app.use(errorHandler);

export default app;
