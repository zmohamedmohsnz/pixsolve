import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import app from '../src/app.js';

test('GET /health returns HTTP 200 and correct response body', async () => {
  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
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