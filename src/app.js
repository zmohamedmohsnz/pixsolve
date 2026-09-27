// ─── Import Modules ─────────────────────────────────────────────────────────────

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUiDist from 'swagger-ui-dist';
import errorHandler from './middleware/handle-errors.js';
import ApiError from './errors/api-error.js';
import requestLogger from './middleware/log-request.js';
import corsOptions from './config/cors.js';
import authRouter from './routes/auth-routes.js'
import imageProcessingjobRouter from './routes/image-processing-job-routes.js';

// ─── Documentation Constants ────────────────────────────────────────────────────

const appDirectoryName = path.dirname(fileURLToPath(import.meta.url));

const openApiDocumentPath = path.join(
  appDirectoryName,
  'docs',
  'openapi.json'
);

const swaggerInitializerPath = path.join(
  appDirectoryName,
  'docs',
  'swagger-ui-initializer.js'
);

// ─── Create Express App ─────────────────────────────────────────────────────────

const app = express();

// ─── GLOBAL MIDDLEWARE ──────────────────────────────────────────────────────────

// tells browser which origins are allowed to read responses
// from our API by setting some HTTP response headers.
app.use(cors(corsOptions));

// capture every request and its response
app.use(requestLogger);

// returns some response headers that mitigate browser-based attacks.
app.use(helmet());

// parses the JSON bodies.
app.use(express.json({ limit: '10kb' }));

// ─── Documentation Routes ───────────────────────────────────────────────────────

app.get('/api/v1/openapi.json', (_req, res) => {
  return res.sendFile(openApiDocumentPath);
});

app.get('/api/v1/docs/swagger-initializer.js', (_req, res) => {
  res.type('application/javascript');
  return res.sendFile(swaggerInitializerPath);
});

app.use(
  '/api/v1/docs',
  express.static(swaggerUiDist.getAbsoluteFSPath())
);

// ─── APP Routes ─────────────────────────────────────────────────────────────────

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
