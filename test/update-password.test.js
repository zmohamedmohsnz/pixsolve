import assert from 'node:assert/strict';
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
const currentPassword = 'CurrentPass1!';
const newPassword = 'NewStrongPass1!';
const userId = '507f1f77bcf86cd799439011';

const validPayload = {
  curPassword: currentPassword,
  newPassword,
  confirmPassword: newPassword
};

const signAccessToken = ({ iat, expiresIn = 60 } = {}) => jwt.sign(
  iat === undefined ? {} : { iat },
  config.jwt.accessTokenSecret,
  {
    algorithm: 'HS256',
    subject: userId,
    expiresIn
  }
);

const selectable = user => {
  user.select = async () => user;
  return user;
};

const createUser = ({ passwordMatches = true, passwordChangedAt = null } = {}) => selectable({
  _id: { toString: () => userId },
  email,
  isActive: true,
  emailVerifiedAt: new Date(),
  password: 'current-password-hash',
  passwordChangedAt,
  comparePassword: async candidate => passwordMatches && candidate === currentPassword,
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

test('updates the password, sends a safe notification, and accepts only the new password at login', async () => {
  const user = createUser();
  const updatedUser = {
    ...user,
    password: 'new-password-hash'
  };
  const sentMessages = [];
  let updateCall;

  mock.method(User, 'findById', () => user);
  mock.method(User, 'hashPassword', async password => {
    assert.equal(password, newPassword);
    return 'new-password-hash';
  });
  mock.method(User, 'findOneAndUpdate', (...arguments_) => {
    updateCall = arguments_;
    return { select: async () => updatedUser };
  });
  mock.method(User, 'findOne', () => ({
    select: async () => ({
      ...updatedUser,
      comparePassword: async candidate => candidate === newPassword
    })
  }));
  mock.method(resend.emails, 'send', async payload => {
    sentMessages.push(payload);
    return { data: { id: 'email-test-id' }, error: null };
  });

  const updateResponse = await request(app)
    .patch('/api/v1/auth/update-password')
    .set('Authorization', `Bearer ${signAccessToken()}`)
    .send(validPayload);

  assert.equal(updateResponse.status, 200);
  assert.deepEqual(updateResponse.body, {
    status: 'success',
    message: 'Password updated successfully. Please login again.'
  });
  assert.equal(updateCall[0].password, 'current-password-hash');
  assert.equal(updateCall[1].password, 'new-password-hash');
  assert.ok(updateCall[1].passwordChangedAt instanceof Date);
  assert.ok(!JSON.stringify(updateResponse.body).includes('new-password-hash'));

  const oldPasswordLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: currentPassword });
  const newPasswordLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: newPassword });

  assert.equal(oldPasswordLogin.status, 401);
  assert.equal(newPasswordLogin.status, 200);

  const passwordUpdateEmail = sentMessages.find(
    message => message.subject === 'Your PixSolve password was updated'
  );
  assert.ok(passwordUpdateEmail);
  assert.ok(!JSON.stringify(passwordUpdateEmail).includes(currentPassword));
  assert.ok(!JSON.stringify(passwordUpdateEmail).includes(newPassword));
  assert.ok(!JSON.stringify(passwordUpdateEmail).includes('new-password-hash'));
});

test('rejects a missing access token before querying or updating the User', async () => {
  mock.method(User, 'findById', () => {
    assert.fail('Missing authentication must not query the User');
  });
  mock.method(User, 'findOneAndUpdate', () => {
    assert.fail('Missing authentication must not update the User');
  });

  const response = await request(app)
    .patch('/api/v1/auth/update-password')
    .send(validPayload);

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'AUTHENTICATION_REQUIRED');
});

test('validates the password-update payload before loading the password hash', async () => {
  const user = createUser();
  let findByIdCalls = 0;

  mock.method(User, 'findById', () => {
    findByIdCalls += 1;
    return user;
  });
  mock.method(User, 'findOneAndUpdate', () => {
    assert.fail('Invalid payload must not update the User');
  });

  const response = await request(app)
    .patch('/api/v1/auth/update-password')
    .set('Authorization', `Bearer ${signAccessToken()}`)
    .send({ ...validPayload, confirmPassword: 'DoesNotMatch1!' });

  assert.equal(response.status, 422);
  assert.equal(response.body.code, 'VALIDATION_ERROR');
  assert.equal(findByIdCalls, 1);
});

test('rejects an incorrect current password without hashing or updating the User', async () => {
  const user = createUser({ passwordMatches: false });

  mock.method(User, 'findById', () => user);
  mock.method(User, 'hashPassword', () => {
    assert.fail('An incorrect current password must not be hashed');
  });
  mock.method(User, 'findOneAndUpdate', () => {
    assert.fail('An incorrect current password must not update the User');
  });

  const response = await request(app)
    .patch('/api/v1/auth/update-password')
    .set('Authorization', `Bearer ${signAccessToken()}`)
    .send(validPayload);

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'INVALID_CURRENT_PASSWORD',
    message: 'Current password is incorrect.'
  });
});

test('invalidates access tokens issued before a successful password update', async () => {
  const user = createUser();
  let passwordChangedAt;

  mock.method(User, 'findById', () => user);
  mock.method(User, 'hashPassword', async () => 'new-password-hash');
  mock.method(User, 'findOneAndUpdate', (_filter, update) => {
    passwordChangedAt = update.passwordChangedAt;
    return {
      select: async () => ({
        ...user,
        password: 'new-password-hash',
        passwordChangedAt
      })
    };
  });
  mock.method(resend.emails, 'send', async () => ({
    data: { id: 'email-test-id' }, error: null
  }));

  const updateResponse = await request(app)
    .patch('/api/v1/auth/update-password')
    .set('Authorization', `Bearer ${signAccessToken()}`)
    .send(validPayload);

  assert.equal(updateResponse.status, 200);
  assert.ok(passwordChangedAt instanceof Date);

  mock.restoreAll();
  mock.method(User, 'findById', async () => ({
    _id: userId,
    isActive: true,
    passwordChangedAt
  }));

  const olderToken = signAccessToken({
    iat: Math.floor(passwordChangedAt.getTime() / 1000) - 5
  });
  const response = await request(createAuthenticationApp())
    .get('/protected')
    .set('Authorization', `Bearer ${olderToken}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'PASSWORD_CHANGED');
});

test('returns success when the password-update notification cannot be delivered', async () => {
  const user = createUser();

  mock.method(User, 'findById', () => user);
  mock.method(User, 'hashPassword', async () => 'new-password-hash');
  mock.method(User, 'findOneAndUpdate', () => ({
    select: async () => ({ ...user, password: 'new-password-hash' })
  }));
  mock.method(resend.emails, 'send', async () => {
    throw new Error('Provider unavailable');
  });

  const response = await request(app)
    .patch('/api/v1/auth/update-password')
    .set('Authorization', `Bearer ${signAccessToken()}`)
    .send(validPayload);

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'success');
});
