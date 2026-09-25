import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import test, { after, afterEach, mock } from 'node:test';
import request from 'supertest';
import app from '../src/app.js';
import resend from '../src/config/resend.js';
import User from '../src/models/user.js';
import {
  shutdownImageProcessingQueue
} from '../src/queues/image-processing-queue.js';

const validSignup = {
  name: '  Ada   Lovelace  ',
  email: '  ADA@EXAMPLE.COM  ',
  password: 'StrongPass1!',
  confirmPassword: 'StrongPass1!'
};

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await shutdownImageProcessingQueue();
});

test('creates an unverified User and requests one verification email', async () => {
  let createdUser;
  const sentMessages = [];

  mock.method(User, 'create', async attributes => {
    createdUser = new User(attributes);
    return createdUser;
  });
  mock.method(User.prototype, 'save', async function() {
    return this;
  });
  mock.method(resend.emails, 'send', async payload => {
    sentMessages.push(payload);
    return { data: { id: 'email-test-id' }, error: null };
  });

  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send(validSignup);

  assert.equal(response.status, 201);
  assert.deepEqual(response.body, {
    status: 'success',
    message: 'Account created. Please check your email to get verified before login'
  });
  assert.equal(createdUser.name, 'Ada Lovelace');
  assert.equal(createdUser.email, 'ada@example.com');
  assert.equal(createdUser.emailVerifiedAt, null);
  assert.match(createdUser.emailVerificationToken, /^[a-f0-9]{64}$/);
  assert.ok(createdUser.emailVerificationTokenExpiresAt instanceof Date);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to, 'ada@example.com');
  assert.equal(typeof sentMessages[0].text, 'string');
  assert.equal(typeof sentMessages[0].html, 'string');
  const verificationUrl = new URL(
    sentMessages[0].text.match(/Verify your email: (\S+)/)[1]
  );
  assert.equal(verificationUrl.origin, 'http://localhost:3000');
  assert.equal(verificationUrl.pathname, '/verify-email');
  assert.match(verificationUrl.searchParams.get('token'), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(verificationUrl.hash, '');
  assert.equal(verificationUrl.searchParams.size, 1);
  assert.equal(
    createdUser.emailVerificationToken,
    createHash('sha256')
      .update(verificationUrl.searchParams.get('token'))
      .digest('hex')
  );
  assert.ok(!JSON.stringify(response.body).includes(createdUser.emailVerificationToken));
});

test('rejects invalid signup data before creating a User or sending email', async () => {
  mock.method(User, 'create', async () => {
    assert.fail('Invalid signup data must not create a User');
  });
  mock.method(resend.emails, 'send', async () => {
    assert.fail('Invalid signup data must not send email');
  });

  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({ ...validSignup, confirmPassword: 'DoesNotMatch1!' });

  assert.equal(response.status, 422);
  assert.equal(response.body.code, 'VALIDATION_ERROR');
});

test('uses the centralized conflict response for duplicate signup email', async () => {
  mock.method(User, 'create', async () => {
    const error = new Error('duplicate key');
    error.name = 'MongoServerError';
    error.code = 11000;
    error.keyPattern = { email: 1 };
    throw error;
  });

  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send(validSignup);

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'DUPLICATE_VALUE',
    message: 'A resource with that value already exists',
    details: { fields: ['email'] }
  });
});

test('verifies a User with a valid unexpired token and consumes it atomically', async () => {
  const token = randomBytes(32).toString('base64url');
  const verifiedUser = new User({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'StrongPass1!'
  });
  let call;

  mock.method(User, 'findOneAndUpdate', async (...arguments_) => {
    call = arguments_;
    return verifiedUser;
  });

  const response = await request(app)
    .post('/api/v1/auth/verify-email')
    .send({ token });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: 'success',
    message: 'Email verified successfully'
  });
  assert.equal(
    call[0].emailVerificationToken,
    createHash('sha256').update(token).digest('hex')
  );
  assert.equal(call[0].emailVerifiedAt, null);
  assert.ok(call[0].emailVerificationTokenExpiresAt.$gt <= Date.now());
  assert.ok(call[1].$set.emailVerifiedAt instanceof Date);
  assert.deepEqual(call[1].$unset, {
    emailVerificationToken: '',
    emailVerificationTokenExpiresAt: ''
  });
  assert.equal(call[2].new, true);
});

test('rejects malformed verification tokens through centralized error handling', async () => {
  const response = await request(app)
    .post('/api/v1/auth/verify-email')
    .send({ token: 'not-a-valid-token' });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'INVALID_TOKEN',
    message: 'Token is invalid or has expired'
  });
});

for (const state of ['expired', 'already used']) {
  test(`rejects an ${state} verification token`, async () => {
    const token = randomBytes(32).toString('base64url');

    mock.method(User, 'findOneAndUpdate', async () => null);

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_TOKEN');
  });
}
