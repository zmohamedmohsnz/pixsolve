import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';
import SwaggerParser from '@apidevtools/swagger-parser';
import request from 'supertest';
import app from '../src/app.js';
import {
  shutdownImageProcessingQueue
} from '../src/queues/image-processing-queue.js';

const documentUrl = new URL('../src/docs/openapi.json', import.meta.url);
const documentPath = fileURLToPath(documentUrl);

after(async () => {
  await shutdownImageProcessingQueue();
});

test('OpenAPI document is valid and documents the implemented V1 routes', async () => {
  const api = await SwaggerParser.validate(documentPath);

  assert.equal(api.openapi, '3.0.3');
  assert.deepEqual(Object.keys(api.paths).sort(), [
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/login',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/signup',
    '/api/v1/auth/update-password',
    '/api/v1/auth/verify-email',
    '/api/v1/image-processing/jobs',
    '/api/v1/image-processing/jobs/{id}'
  ]);

  const createJob = api.paths['/api/v1/image-processing/jobs'].post;
  const multipartSchema = createJob.requestBody.content[
    'multipart/form-data'
  ].schema;

  assert.deepEqual(multipartSchema.required, ['image', 'operation', 'options']);
  assert.equal(multipartSchema.properties.image.format, 'binary');
  assert.equal(multipartSchema.properties.options.type, 'string');
  assert.match(multipartSchema.properties.options.description, /JSON-encoded text/);
  assert.deepEqual(createJob.security, [{ BearerAuth: [] }, {}]);

  const getJob = api.paths['/api/v1/image-processing/jobs/{id}'].get;
  assert.deepEqual(getJob.security, [
    { BearerAuth: [] },
    { GuestAccessToken: [] }
  ]);
  assert.match(getJob.description, /Credential precedence applies/);
});

test('serves the exact OpenAPI document and Swagger UI under Helmet CSP', async () => {
  const expectedDocument = JSON.parse(await readFile(documentPath, 'utf8'));

  const documentResponse = await request(app).get('/api/v1/openapi.json');
  assert.equal(documentResponse.status, 200);
  assert.match(documentResponse.headers['content-type'], /^application\/json/);
  assert.deepEqual(documentResponse.body, expectedDocument);

  const pageResponse = await request(app).get('/api/v1/docs/');
  assert.equal(pageResponse.status, 200);
  assert.match(pageResponse.headers['content-type'], /^text\/html/);
  assert.match(pageResponse.text, /swagger-initializer\.js/);
  assert.match(pageResponse.headers['content-security-policy'], /script-src 'self'/);

  const initializerResponse = await request(app)
    .get('/api/v1/docs/swagger-initializer.js');
  assert.equal(initializerResponse.status, 200);
  assert.match(
    initializerResponse.headers['content-type'],
    /^application\/javascript/
  );
  assert.match(initializerResponse.text, /\/api\/v1\/openapi\.json/);

  const bundleResponse = await request(app)
    .get('/api/v1/docs/swagger-ui-bundle.js');
  assert.equal(bundleResponse.status, 200);
  assert.match(bundleResponse.headers['content-type'], /^text\/javascript/);
});
