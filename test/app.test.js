import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import app from '../src/app.js';
import {
  shutdownImageProcessingQueue
} from '../src/queues/image-processing-queue.js';

after(async () => {
  await shutdownImageProcessingQueue();
});

test('GET /health returns HTTP 200 and correct response body', async () => {
  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('allows the configured frontend origin to read API responses', async () => {
  const response = await request(app)
    .get('/health')
    .set('Origin', 'http://localhost:5173');

  assert.equal(response.status, 200);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(response.headers.vary, 'Origin');
});

test('does not grant an unconfigured origin browser access to API responses', async () => {
  const response = await request(app)
    .get('/health')
    .set('Origin', 'https://untrusted.example');

  assert.equal(response.status, 200);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
  assert.equal(response.headers.vary, 'Origin');
});

test('handles CORS preflight for the configured frontend origin', async () => {
  const response = await request(app)
    .options('/api/v1/auth/login')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'authorization, content-type');

  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.match(response.headers['access-control-allow-methods'], /POST/);
  assert.equal(response.headers['access-control-allow-headers'], 'authorization, content-type');
  assert.equal(response.headers.vary, 'Origin, Access-Control-Request-Headers');
});

test('does not grant an unconfigured origin browser access during preflight', async () => {
  const response = await request(app)
    .options('/api/v1/auth/login')
    .set('Origin', 'https://untrusted.example')
    .set('Access-Control-Request-Method', 'POST');

  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('undefined route returns the standard not-found response', async () => {
  const response = await request(app).get('/undefined-route');
  
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'ROUTE_NOT_FOUND',
    message: 'Cannot find GET /undefined-route'
  });
});

test('POST /api/v1/image-processing/jobs is the guest job-creation endpoint', async () => {
  const response = await request(app).post('/api/v1/image-processing/jobs');

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'IMAGE_REQUIRED',
    message: 'An image file is required'
  });
});
