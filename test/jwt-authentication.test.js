import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test, { after, afterEach, mock } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';
import config from '../src/config/env.js';
import User from '../src/models/user.js';
import resend from '../src/config/resend.js';
import authenticate from '../src/middleware/auth.middleware.js';
import errorHandler from '../src/middleware/handle-errors.js';
import {
  shutdownImageProcessingQueue
} from '../src/queues/image-processing-queue.js';

const validLogin = {
  email: '  ADA@EXAMPLE.COM  ',
  password: 'StrongPass1!'
};

const userId = '507f1f77bcf86cd799439011';

const createUser = ({
  passwordMatches = true,
  emailVerifiedAt = new Date(),
  isActive = true
} = {}) => ({
  _id: {
    toString: () => userId
  },
  email: 'ada@example.com',
  emailVerifiedAt,
  isActive,
  comparePassword: async () => passwordMatches,
  createEmailVerificationToken: () => randomBytes(32).toString('base64url'),
  save: async function () {
    return this;
  }
});

const mockLoginUser = user => {
  mock.method(User, 'findOne', () => ({
    select: async () => user
  }));
};

const mockEmailDelivery = () => {
  mock.method(resend.emails, 'send', async () => ({
    data: { id: 'email-test-id' },
    error: null
  }));
};

const signAccessToken = (options = {}) => jwt.sign(
  {},
  config.jwt.accessTokenSecret,
  {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: 60,
    ...options
  }
);

const createMiddlewareApp = () => {
  const testApp = express();

  testApp.get(
    '/required',
    authenticate({ optional: false }),
    (req, res) => res.json({ userId: req.user.id.toString() })
  );

  testApp.get(
    '/optional',
    authenticate({ optional: true }),
    (req, res) => res.json({ userId: req.user?.id?.toString() ?? null })
  );

  testApp.use(errorHandler);

  return testApp;
};

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await shutdownImageProcessingQueue();
});

test('logs in a verified active User and returns a minimal HS256 access token', async () => {
  const user = createUser();
  mockLoginUser(user);
  mockEmailDelivery();

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send(validLogin);

  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers.pragma, 'no-cache');
  assert.equal(response.body.status, 'success');
  assert.equal(response.body.data.tokenType, 'Bearer');
  assert.equal(response.body.data.expiresIn, 900);
  assert.equal(typeof response.body.data.accessToken, 'string');
  assert.ok(user.lastLoginAt instanceof Date);

  const payload = jwt.verify(
    response.body.data.accessToken,
    config.jwt.accessTokenSecret,
    { algorithms: ['HS256'] }
  );

  assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'sub']);
  assert.equal(payload.sub, userId);
  assert.ok(payload.exp > payload.iat);
});

test('returns the same invalid-credentials response for an unknown email and wrong password', async () => {
  mockEmailDelivery();
  mockLoginUser(null);

  const unknownEmailResponse = await request(app)
    .post('/api/v1/auth/login')
    .send(validLogin);

  mock.restoreAll();
  mockEmailDelivery();
  mockLoginUser(createUser({ passwordMatches: false }));

  const wrongPasswordResponse = await request(app)
    .post('/api/v1/auth/login')
    .send(validLogin);

  assert.equal(unknownEmailResponse.status, 401);
  assert.deepEqual(wrongPasswordResponse.body, unknownEmailResponse.body);
  assert.deepEqual(unknownEmailResponse.body, {
    status: 'error',
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password.'
  });
});

test('rejects an unverified User after re-sending a verification email', async () => {
  mockLoginUser(createUser({ emailVerifiedAt: null }));
  mockEmailDelivery();

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send(validLogin);

  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'EMAIL_NOT_VERIFIED');
});

test('validates the login payload with Zod before querying for a User', async () => {
  mock.method(User, 'findOne', () => {
    assert.fail('Invalid login input must not query Users');
  });

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'not-an-email', password: 'password' });

  assert.equal(response.status, 422);
  assert.equal(response.body.code, 'VALIDATION_ERROR');
});

test('required authentication accepts a valid Bearer token and exposes its User identity', async () => {
  const middlewareApp = createMiddlewareApp();
  mock.method(User, 'findById', async id => ({ _id: id, isActive: true }));

  const response = await request(middlewareApp)
    .get('/required')
    .set('Authorization', `Bearer ${signAccessToken()}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { userId });
});

test('required authentication rejects missing, malformed, invalid, and expired tokens', async () => {
  const middlewareApp = createMiddlewareApp();
  const expiredToken = signAccessToken({ expiresIn: -1 });

  const cases = [
    { header: undefined, code: 'AUTHENTICATION_REQUIRED' },
    { header: 'Basic credentials', code: 'INVALID_ACCESS_TOKEN' },
    { header: `X Bearer ${signAccessToken()}`, code: 'INVALID_ACCESS_TOKEN' },
    { header: 'Bearer invalid-token', code: 'INVALID_ACCESS_TOKEN' },
    { header: `Bearer ${expiredToken}`, code: 'INVALID_ACCESS_TOKEN' }
  ];

  for (const { header, code } of cases) {
    const requestBuilder = request(middlewareApp).get('/required');
    if (header !== undefined) requestBuilder.set('Authorization', header);

    const response = await requestBuilder;

    assert.equal(response.status, 401);
    assert.equal(response.body.code, code);
  }
});

test('optional authentication allows no token, attaches a valid User, and rejects an invalid supplied token', async () => {
  const middlewareApp = createMiddlewareApp();
  mock.method(User, 'findById', async id => ({ _id: id, isActive: true }));

  const guestResponse = await request(middlewareApp).get('/optional');
  const authenticatedResponse = await request(middlewareApp)
    .get('/optional')
    .set('Authorization', `Bearer ${signAccessToken()}`);
  const invalidTokenResponse = await request(middlewareApp)
    .get('/optional')
    .set('Authorization', 'Bearer invalid-token');

  assert.deepEqual(guestResponse.body, { userId: null });
  assert.deepEqual(authenticatedResponse.body, { userId });
  assert.equal(invalidTokenResponse.status, 401);
  assert.equal(invalidTokenResponse.body.code, 'INVALID_ACCESS_TOKEN');
});
