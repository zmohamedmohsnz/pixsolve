// ─── Import Modules ─────────────────────────────────────────────────────────────

import express from 'express';
import helmet from 'helmet';
import errorHandler from './middleware/handle-errors.js';
import ApiError from './errors/api-error.js';
import requestLogger from './middleware/log-request.js';
import authRouter from './routes/auth-routes.js'
import imageProcessingjobRouter from './routes/image-processing-job-routes.js';

// ─── Create Express App ─────────────────────────────────────────────────────────

const app = express();

// ─── GLOBAL MIDDLEWARE ──────────────────────────────────────────────────────────

// capture every request and its response
app.use(requestLogger);

// returns some response headers that mitigate browser-based attacks.
app.use(helmet());

// parses the JSON bodies.
app.use(express.json({ limit: '10kb' }));

// ─── ROUTES ─────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/image-processing/jobs', imageProcessingjobRouter);

// ─── Not Found Route Handler Middleware ─────────────────────────────────────────

// when execution reaches this line, this means
// the request searches about a route doesn't exist.
app.use((req, _res, next) => {
  return next(
    new ApiError(
      `Cannot find ${req.method} ${req.path}`,
      404,
      { code: 'ROUTE_NOT_FOUND'})
    );
});

// ─── Error Handler Middleware ───────────────────────────────────────────────────

app.use(errorHandler);

export default app;
