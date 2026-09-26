import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import test, { after, afterEach, mock } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';
import config from '../src/config/env.js';
import resend from '../src/config/resend.js';
import User from '../src/models/user.js';
import authenticate from '../src/middleware/authenticate.js';
import errorHandler from '../src/middleware/handle-errors.js';
import {
  shutdownImageProcessingQueue
} from '../src/queues/image-processing-queue.js';

const email = 'ada@example.com';
const oldPassword = 'OldStrongPass1!';
const newPassword = 'NewStrongPass1!';
const userId = '507f1f77bcf86cd799439011';

const createForgotPasswordUser = () => ({
  _id: { toString: () => userId },
  email,
  isActive: true,
  createPasswordResetToken() {
    const token = randomBytes(32).toString('base64url');
    this.passwordResetToken = createHash('sha256').update(token).digest('hex');
    this.passwordResetTokenExpiresAt = new Date(Date.now() + 60_000);
    return token;
  },
  save: async function() {
    return this;
  }
});

const createResetUser = () => ({
  _id: { toString: () => userId },
  email,
  isActive: true,
  emailVerifiedAt: new Date(),
  password: 'old-password-hash',
  comparePassword: async candidate => candidate === oldPassword,
  save: async function() {
    return this;
  }
});

const createAuthenticationApp = () => {
  const testApp = express();

  testApp.get(
    '/protected',
    authenticate({ optional: false }),
    (_req, res) => res.status(200).json({ status: 'ok' })
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

test('returns the same response for registered and unknown forgot-password emails', async () => {
  const user = createForgotPasswordUser();
  const messages = [];

  mock.method(User, 'findOne', async () => user);
  mock.method(resend.emails, 'send', async payload => {
    messages.push(payload);
    return { data: { id: 'email-test-id' }, error: null };
  });

  const registeredResponse = await request(app)
    .post('/api/v1/auth/forgot-password')
    .send({ email });

  mock.restoreAll();
  mock.method(User, 'findOne', async () => null);
  mock.method(resend.emails, 'send', async () => {
    assert.fail('Unknown emails must not request delivery');
  });

  const unknownResponse = await request(app)
    .post('/api/v1/auth/forgot-password')
    .send({ email: 'unknown@example.com' });

  assert.equal(registeredResponse.status, 200);
  assert.deepEqual(unknownResponse.body, registeredResponse.body);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, email);

  const resetUrl = new URL(
    messages[0].text.match(/Reset your password: (\S+)/)[1]
  );
  const rawToken = resetUrl.searchParams.get('token');

  assert.equal(resetUrl.origin, 'http://localhost:3000');
  assert.equal(resetUrl.pathname, '/reset-password');
  assert.match(rawToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(resetUrl.searchParams.size, 1);
  assert.equal(
    user.passwordResetToken,
    createHash('sha256').update(rawToken).digest('hex')
  );
  assert.notEqual(user.passwordResetToken, rawToken);
  assert.ok(user.passwordResetTokenExpiresAt instanceof Date);
  assert.ok(!JSON.stringify(registeredResponse.body).includes(rawToken));
});

test('treats an inactive account like an unknown forgot-password email', async () => {
  let query;

  mock.method(User, 'findOne', async filter => {
    query = filter;
    return null;
  });
  mock.method(resend.emails, 'send', async () => {
    assert.fail('Inactive accounts must not request delivery');
  });

  const response = await request(app)
    .post('/api/v1/auth/forgot-password')
    .send({ email });

  assert.equal(response.status, 200);
  assert.deepEqual(query, { email, isActive: true });
});

test('resets a password atomically and invalidates a previously issued access token', async () => {
  const token = randomBytes(32).toString('base64url');
  const passwordResetToken = createHash('sha256').update(token).digest('hex');
  const user = createResetUser();
  let updateCall;

  mock.method(User, 'findOne', filter => {
    if (filter.passwordResetToken) {
      return { select: async () => user };
    }

    return { select: async () => user };
  });
  mock.method(User, 'hashPassword', async () => 'new-password-hash');
  mock.method(User, 'findOneAndUpdate', async (...arguments_) => {
    updateCall = arguments_;
    user.password = arguments_[1].$set.password;
    user.passwordChangedAt = arguments_[1].$set.passwordChangedAt;
    user.comparePassword = async candidate => candidate === newPassword;
    return user;
  });
  mock.method(resend.emails, 'send', async () => ({
    data: { id: 'email-test-id' }, error: null
  }));

  const resetResponse = await request(app)
    .patch('/api/v1/auth/reset-password')
    .send({ token, password: newPassword, confirmPassword: newPassword });

  assert.equal(resetResponse.status, 200);
  assert.equal(updateCall[0].isActive, true);
  assert.equal(updateCall[0].passwordResetToken, passwordResetToken);
  assert.equal(updateCall[0].password, 'old-password-hash');
  assert.ok(updateCall[0].passwordResetTokenExpiresAt.$gt <= Date.now());
  assert.equal(updateCall[1].$set.password, 'new-password-hash');
  assert.ok(updateCall[1].$set.passwordChangedAt instanceof Date);
  assert.deepEqual(updateCall[1].$unset, {
    passwordResetToken: '',
    passwordResetTokenExpiresAt: ''
  });

  const oldPasswordLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: oldPassword });
  const newPasswordLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: newPassword });

  assert.equal(oldPasswordLogin.status, 401);
  assert.equal(newPasswordLogin.status, 200);

  const accessToken = jwt.sign(
    { iat: Math.floor(user.passwordChangedAt.getTime() / 1000) - 5 },
    config.jwt.accessTokenSecret,
    { algorithm: 'HS256', subject: userId, expiresIn: 60 }
  );
  mock.restoreAll();
  mock.method(User, 'findById', async () => user);

  const protectedResponse = await request(createAuthenticationApp())
    .get('/protected')
    .set('Authorization', `Bearer ${accessToken}`);

  assert.equal(protectedResponse.status, 401);
  assert.equal(protectedResponse.body.code, 'PASSWORD_CHANGED');
});

test('rejects malformed, expired, and previously used reset tokens', async () => {
  const malformedResponse = await request(app)
    .patch('/api/v1/auth/reset-password')
    .send({
      token: 'not-a-reset-token',
      password: newPassword,
      confirmPassword: newPassword
    });

  assert.equal(malformedResponse.status, 400);
  assert.equal(malformedResponse.body.code, 'INVALID_PASSWORD_RESET_TOKEN');

  for (const state of ['expired', 'previously used']) {
    mock.method(User, 'findOne', () => ({ select: async () => null }));

    const response = await request(app)
      .patch('/api/v1/auth/reset-password')
      .send({
        token: randomBytes(32).toString('base64url'),
        password: newPassword,
        confirmPassword: newPassword
      });

    assert.equal(response.status, 400, state);
    assert.equal(response.body.code, 'INVALID_PASSWORD_RESET_TOKEN', state);
    mock.restoreAll();
  }
});
