// ─── Import Modules ─────────────────────────────────────────────────────────────

import express from 'express';
import helmet from 'helmet';
import errorHandler from './middleware/errorHandler.js';
import AppError from './errors/AppError.js';

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

// ─── Not Found Route Handler Middleware ─────────────────────────────────────────

// when execution reaches this line, this means
// the request searches about a route doesn't exist.
app.use((req, _res, next) => {
  return next(
    new AppError(
      `Cannot find ${req.method} ${req.path}`,
      404,
      { code: 'ROUTE_NOT_FOUND'})
    );
});

// ─── Error Handler Middleware ───────────────────────────────────────────────────

app.use(errorHandler);

export default app;
