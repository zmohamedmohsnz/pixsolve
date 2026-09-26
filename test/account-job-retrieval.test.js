import assert from 'node:assert/strict';
import test, { after, afterEach, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import config from '../src/config/env.js';
import Job from '../src/models/job.js';
import User from '../src/models/user.js';
import { shutdownImageProcessingQueue } from '../src/queues/image-processing-queue.js';

const PATH = '/api/v1/image-processing/jobs';
const GUEST_TOKEN = 'A'.repeat(43);

const signAccessToken = userId => jwt.sign(
  {},
  config.jwt.accessTokenSecret,
  {
    algorithm: 'HS256',
    subject: userId.toString(),
    expiresIn: 60
  }
);

const mockAuthenticatedUser = userId => {
  mock.method(User, 'findById', async receivedId => (
    receivedId === userId.toString()
      ? { _id: userId, isActive: true }
      : null
  ));
};

const makeJob = (userId, status) => ({
  _id: new mongoose.Types.ObjectId(),
  user: userId,
  operation: 'resize',
  options: { width: 800, height: 600 },
  status,
  inputFile: { publicId: 'private-input', secureUrl: 'https://example.com/input.png' },
  outputFile: status === 'completed'
    ? { publicId: 'private-output', secureUrl: 'https://example.com/output.png' }
    : undefined,
  errorMessage: status === 'failed' ? 'image processing job failed' : undefined,
  createdAt: new Date('2026-09-26T10:00:00.000Z'),
  updatedAt: new Date('2026-09-26T10:00:05.000Z')
});

const mockAccountLookup = job => {
  mock.method(Job, 'findOne', filter => ({
    async lean() {
      return filter._id === job._id.toString() &&
        filter.user.toString() === job.user.toString()
        ? job
        : null;
    }
  }));
};

afterEach(() => mock.restoreAll());
after(async () => shutdownImageProcessingQueue());

for (const status of ['pending', 'processing', 'completed', 'failed']) {
  test(`returns only safe fields for an owner ${status} job`, async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const job = makeJob(ownerId, status);
    mockAuthenticatedUser(ownerId);
    mockAccountLookup(job);

    const response = await request(app)
      .get(`${PATH}/${job._id}`)
      .set('Authorization', `Bearer ${signAccessToken(ownerId)}`);

    const expected = {
      id: job._id.toString(),
      operation: job.operation,
      options: job.options,
      status,
      createdAt: '2026-09-26T10:00:00.000Z',
      updatedAt: '2026-09-26T10:00:05.000Z'
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
      user: ownerId
    });
    for (const field of ['inputFile', 'publicId', 'user', 'guestAccessTokenHash']) {
      assert.equal(JSON.stringify(response.body).includes(`\"${field}\"`), false);
    }
  });
}

test('conceals an account job from another authenticated user', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  const job = makeJob(ownerId, 'completed');
  mockAuthenticatedUser(otherUserId);
  mockAccountLookup(job);

  const response = await request(app)
    .get(`${PATH}/${job._id}`)
    .set('Authorization', `Bearer ${signAccessToken(otherUserId)}`);

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    status: 'error', code: 'JOB_NOT_FOUND', message: 'Job not found'
  });
});

test('does not allow a guest credential to retrieve an account job', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const job = makeJob(ownerId, 'completed');
  mock.method(Job, 'findOne', filter => ({
    async lean() {
      return filter.user === null ? null : assert.fail('Guest mode must query only guest jobs');
    }
  }));

  const response = await request(app)
    .get(`${PATH}/${job._id}`)
    .set('X-Guest-Access-Token', GUEST_TOKEN);

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    status: 'error', code: 'JOB_NOT_FOUND', message: 'Job not found'
  });
});

test('requires a guest credential when unauthenticated access targets an account job', async () => {
  const jobId = new mongoose.Types.ObjectId();
  mock.method(Job, 'findOne', () => assert.fail('Must not query without a guest credential'));

  const response = await request(app).get(`${PATH}/${jobId}`);

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'GUEST_ACCESS_TOKEN_REQUIRED',
    message: 'Guest access token is required.'
  });
  assert.equal(Job.findOne.mock.callCount(), 0);
});

test('does not allow a JWT to retrieve a guest job', async () => {
  const userId = new mongoose.Types.ObjectId();
  const guestJob = makeJob(null, 'completed');
  mockAuthenticatedUser(userId);
  mock.method(Job, 'findOne', filter => ({
    async lean() {
      return filter.user?.toString() === userId.toString() ? null : assert.fail('JWT mode must query by owner');
    }
  }));

  const response = await request(app)
    .get(`${PATH}/${guestJob._id}`)
    .set('Authorization', `Bearer ${signAccessToken(userId)}`);

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    status: 'error', code: 'JOB_NOT_FOUND', message: 'Job not found'
  });
});

test('uses a valid JWT instead of a simultaneously supplied guest credential', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const job = makeJob(ownerId, 'pending');
  mockAuthenticatedUser(ownerId);
  mockAccountLookup(job);

  const response = await request(app)
    .get(`${PATH}/${job._id}`)
    .set('Authorization', `Bearer ${signAccessToken(ownerId)}`)
    .set('X-Guest-Access-Token', GUEST_TOKEN);

  assert.equal(response.status, 200);
  assert.deepEqual(Job.findOne.mock.calls[0].arguments[0], {
    _id: job._id.toString(),
    user: ownerId
  });
});

test('rejects an invalid supplied JWT without guest fallback', async () => {
  const jobId = new mongoose.Types.ObjectId();
  mock.method(Job, 'findOne', () => assert.fail('Must not query after invalid JWT authentication'));

  const response = await request(app)
    .get(`${PATH}/${jobId}`)
    .set('Authorization', 'Bearer invalid-token')
    .set('X-Guest-Access-Token', GUEST_TOKEN);

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Access token is invalid or expired'
  });
  assert.equal(Job.findOne.mock.callCount(), 0);
});

test('conceals malformed and nonexistent account job IDs', async () => {
  const userId = new mongoose.Types.ObjectId();
  mockAuthenticatedUser(userId);
  mock.method(Job, 'findOne', () => ({ async lean() { return null; } }));

  for (const jobId of ['bad-id', new mongoose.Types.ObjectId().toString()]) {
    const response = await request(app)
      .get(`${PATH}/${jobId}`)
      .set('Authorization', `Bearer ${signAccessToken(userId)}`);

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      status: 'error', code: 'JOB_NOT_FOUND', message: 'Job not found'
    });
  }
  assert.equal(Job.findOne.mock.callCount(), 1);
});

test('sanitizes account database failures through centralized error handling', async () => {
  const userId = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();
  mockAuthenticatedUser(userId);
  mock.method(Job, 'findOne', () => ({
    async lean() {
      throw new Error('MongoDB unavailable');
    }
  }));

  const response = await request(app)
    .get(`${PATH}/${jobId}`)
    .set('Authorization', `Bearer ${signAccessToken(userId)}`);

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  });
});
