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

const makeJob = ({ user, status = 'pending' }) => ({
  _id: new mongoose.Types.ObjectId(),
  user,
  operation: 'resize',
  options: { width: 800, height: 600 },
  status,
  inputFile: {
    publicId: 'private-input',
    secureUrl: 'https://example.com/input.png'
  },
  outputFile: status === 'completed'
    ? {
        publicId: 'private-output',
        secureUrl: 'https://example.com/output.png'
      }
    : undefined,
  errorMessage: status === 'failed' ? 'Image processing failed' : undefined,
  createdAt: new Date('2026-09-27T10:00:00.000Z'),
  updatedAt: new Date('2026-09-27T10:00:05.000Z')
});

const mockHistoryQueries = ({ ownerId, jobs, total }) => {
  const calls = {};

  mock.method(Job, 'find', filter => {
    calls.listFilter = filter;

    const query = {
      sort(sort) {
        calls.sort = sort;
        return query;
      },
      skip(skip) {
        calls.skip = skip;
        return query;
      },
      limit(limit) {
        calls.limit = limit;
        return query;
      },
      async lean() {
        return jobs;
      }
    };

    return query;
  });

  mock.method(Job, 'countDocuments', async filter => {
    calls.countFilter = filter;
    return total;
  });

  return {
    assertPaging({ page, limit }) {
      assert.deepEqual(calls.listFilter, { user: ownerId });
      assert.deepEqual(calls.countFilter, { user: ownerId });
      assert.deepEqual(calls.sort, { createdAt: -1, _id: -1 });
      assert.equal(calls.skip, (page - 1) * limit);
      assert.equal(calls.limit, limit);
    }
  };
};

afterEach(() => mock.restoreAll());
after(async () => shutdownImageProcessingQueue());

test('requires valid authentication before querying processing history', async () => {
  mock.method(Job, 'find', () => {
    assert.fail('History queries must not run without valid authentication');
  });

  const missingToken = await request(app).get(PATH);
  const invalidToken = await request(app)
    .get(PATH)
    .set('Authorization', 'Bearer invalid-token');

  assert.equal(missingToken.status, 401);
  assert.equal(missingToken.body.code, 'AUTHENTICATION_REQUIRED');
  assert.equal(invalidToken.status, 401);
  assert.equal(invalidToken.body.code, 'INVALID_ACCESS_TOKEN');
});

test('returns the default page with safe representations for every job status', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const jobs = [
    makeJob({ user: ownerId, status: 'pending' }),
    makeJob({ user: ownerId, status: 'processing' }),
    makeJob({ user: ownerId, status: 'completed' }),
    makeJob({ user: ownerId, status: 'failed' })
  ];
  mockAuthenticatedUser(ownerId);
  const history = mockHistoryQueries({ ownerId, jobs, total: 4 });

  const response = await request(app)
    .get(PATH)
    .set('Authorization', `Bearer ${signAccessToken(ownerId)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.pagination, {
    page: 1,
    limit: 10,
    total: 4,
    totalPages: 1
  });
  assert.deepEqual(response.body.data.jobs[2].result, {
    downloadUrl: 'https://example.com/output.png'
  });
  assert.deepEqual(response.body.data.jobs[3].error, {
    message: 'Image processing failed'
  });
  for (const privateField of [
    'user', 'inputFile', 'publicId', 'guestAccessTokenHash'
  ]) {
    assert.equal(JSON.stringify(response.body).includes(`\"${privateField}\"`), false);
  }
  history.assertPaging({ page: 1, limit: 10 });
});

test('uses valid pagination values and deterministic paging queries', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  mockAuthenticatedUser(ownerId);
  const history = mockHistoryQueries({
    ownerId,
    jobs: [makeJob({ user: ownerId })],
    total: 23
  });

  const response = await request(app)
    .get(`${PATH}?page=3&limit=10`)
    .set('Authorization', `Bearer ${signAccessToken(ownerId)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.pagination, {
    page: 3,
    limit: 10,
    total: 23,
    totalPages: 3
  });
  history.assertPaging({ page: 3, limit: 10 });
});

test('accepts the maximum limit and returns empty pages successfully', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  mockAuthenticatedUser(ownerId);
  const history = mockHistoryQueries({ ownerId, jobs: [], total: 0 });

  const response = await request(app)
    .get(`${PATH}?page=50&limit=50`)
    .set('Authorization', `Bearer ${signAccessToken(ownerId)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: 'success',
    data: {
      jobs: [],
      pagination: { page: 50, limit: 50, total: 0, totalPages: 0 }
    }
  });
  history.assertPaging({ page: 50, limit: 50 });
});

test('rejects malformed, out-of-range, repeated, and unsupported query parameters', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  mockAuthenticatedUser(ownerId);
  mock.method(Job, 'find', () => {
    assert.fail('Invalid query parameters must not query jobs');
  });

  for (const query of [
    '?page=0',
    '?page=1.5',
    '?page=invalid',
    '?limit=51',
    '?limit=-1',
    '?page=1&page=2',
    '?status=completed',
    '?sort=createdAt'
  ]) {
    const response = await request(app)
      .get(`${PATH}${query}`)
      .set('Authorization', `Bearer ${signAccessToken(ownerId)}`);

    assert.equal(response.status, 422, query);
    assert.equal(response.body.code, 'VALIDATION_ERROR', query);
  }
});

test('sanitizes history database failures through centralized error handling', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  mockAuthenticatedUser(ownerId);
  mock.method(Job, 'find', () => {
    const query = {
      sort() { return query; },
      skip() { return query; },
      limit() { return query; },
      async lean() { throw new Error('MongoDB unavailable'); }
    };
    return query;
  });
  mock.method(Job, 'countDocuments', async () => 0);

  const response = await request(app)
    .get(PATH)
    .set('Authorization', `Bearer ${signAccessToken(ownerId)}`);

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  });
});
