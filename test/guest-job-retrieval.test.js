import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test, { after, afterEach, mock } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import Job from '../src/models/job.js';
import { shutdownImageProcessingQueue } from '../src/queues/image-processing-queue.js';

const TOKEN = 'A'.repeat(43);
const OTHER_TOKEN = 'B'.repeat(43);
const PATH = '/api/v1/image-processing/jobs';
const hash = token => createHash('sha256').update(token).digest('hex');

const makeJob = status => ({
  _id: new mongoose.Types.ObjectId(),
  user: null,
  guestAccessTokenHash: hash(TOKEN),
  operation: 'resize',
  options: { width: 800, height: 600 },
  status,
  inputFile: { publicId: 'private-input', secureUrl: 'https://example.com/input.png' },
  outputFile: status === 'completed'
    ? { publicId: 'private-output', secureUrl: 'https://example.com/output.png' }
    : undefined,
  errorMessage: status === 'failed' ? 'image processing job failed' : undefined,
  createdAt: new Date('2026-09-21T10:00:00.000Z'),
  updatedAt: new Date('2026-09-21T10:00:05.000Z')
});

const mockLookup = job => {
  mock.method(Job, 'findOne', filter => ({
    async lean() {
      return filter._id === job._id.toString() &&
        filter.user === null &&
        filter.guestAccessTokenHash === job.guestAccessTokenHash
        ? job : null;
    }
  }));
};

afterEach(() => mock.restoreAll());
after(async () => shutdownImageProcessingQueue());

for (const status of ['pending', 'processing', 'completed', 'failed']) {
  test(`returns only authorized ${status} job fields`, async () => {
    const job = makeJob(status);
    mockLookup(job);
    const response = await request(app)
      .get(`${PATH}/${job._id}`)
      .set('X-Guest-Access-Token', TOKEN);

    const expected = {
      id: job._id.toString(),
      operation: 'resize',
      options: { width: 800, height: 600 },
      status,
      createdAt: '2026-09-21T10:00:00.000Z',
      updatedAt: '2026-09-21T10:00:05.000Z'
    };
    if (status === 'completed') {
      expected.result = { downloadUrl: 'https://example.com/output.png' };
    }
    if (status === 'failed') {
      expected.error = { message: 'image processing job failed' };
    }

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'success', data: { job: expected } });
    assert.deepEqual(Job.findOne.mock.calls[0].arguments[0], {
      _id: job._id.toString(),
      user: null,
      guestAccessTokenHash: hash(TOKEN)
    });
    for (const field of ['inputFile', 'publicId', 'guestAccessTokenHash', 'user']) {
      assert.equal(JSON.stringify(response.body).includes(`"${field}"`), false);
    }
  });
}

test('requires a nonblank guest token', async () => {
  const jobId = new mongoose.Types.ObjectId();
  mock.method(Job, 'findOne', () => assert.fail('Must not query without a token'));
  for (const token of [undefined, '']) {
    let req = request(app).get(`${PATH}/${jobId}`);
    if (token !== undefined) req = req.set('X-Guest-Access-Token', token);
    const response = await req;
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, {
      status: 'error',
      code: 'GUEST_ACCESS_TOKEN_REQUIRED',
      message: 'Guest access token is required.'
    });
  }
  assert.equal(Job.findOne.mock.callCount(), 0);
});

test('conceals malformed IDs and tokens', async () => {
  const jobId = new mongoose.Types.ObjectId();
  mock.method(Job, 'findOne', () => assert.fail('Must not query malformed input'));
  for (const [id, token] of [['bad-id', TOKEN], [jobId, 'malformed']]) {
    const response = await request(app)
      .get(`${PATH}/${id}`)
      .set('X-Guest-Access-Token', token);
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      status: 'error', code: 'JOB_NOT_FOUND', message: 'Job not found'
    });
  }
  assert.equal(Job.findOne.mock.callCount(), 0);
});

test('conceals nonexistent jobs and another job’s valid token', async () => {
  const job = makeJob('completed');
  mockLookup(job);
  for (const [id, token] of [
    [new mongoose.Types.ObjectId(), TOKEN],
    [job._id, OTHER_TOKEN]
  ]) {
    const response = await request(app)
      .get(`${PATH}/${id}`)
      .set('X-Guest-Access-Token', token);
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      status: 'error', code: 'JOB_NOT_FOUND', message: 'Job not found'
    });
  }
  assert.equal(Job.findOne.mock.calls[1].arguments[0].guestAccessTokenHash, hash(OTHER_TOKEN));
});

test('sanitizes database failures through centralized error handling', async () => {
  const job = makeJob('pending');
  mock.method(Job, 'findOne', () => ({
    async lean() { throw new Error('MongoDB unavailable'); }
  }));
  const response = await request(app)
    .get(`${PATH}/${job._id}`)
    .set('X-Guest-Access-Token', TOKEN);
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  });
});
