import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import mongoose from 'mongoose';
import config from '../src/config/env.js';
import connectToDB from '../src/config/database.js';
import User from '../src/models/user.js';

const validUser = overrides => ({
  name: '  Ada   Lovelace  ',
  email: '  ADA@EXAMPLE.COM  ',
  password: 'StrongPass1!',
  ...overrides
});

before(async () => {
  await connectToDB(config.dbUri);
  await User.init();
});

beforeEach(async () => {
  await User.deleteMany({});
});

after(async () => {
  await User.deleteMany({});
  await mongoose.disconnect();
});

test('normalizes User name and email and enforces email uniqueness', async () => {
  const user = await User.create(validUser());

  assert.equal(user.name, 'Ada Lovelace');
  assert.equal(user.email, 'ada@example.com');

  await assert.rejects(
    User.create(validUser({
      name: 'Grace Hopper',
      email: 'ada@example.com'
    })),
    error => error?.name === 'MongoServerError' && error.code === 11000
  );
});

test('hashes passwords and never returns hashes in normal User serialization', async () => {
  const user = await User.create(validUser());

  assert.notEqual(user.password, 'StrongPass1!');
  assert.match(user.password, /^\$argon2id\$/);
  assert.equal(await user.comparePassword('StrongPass1!'), true);
  assert.equal(await user.comparePassword('WrongPass1!'), false);

  const normallyLoadedUser = await User.findById(user._id);
  assert.equal(normallyLoadedUser.password, undefined);
  assert.equal(Object.hasOwn(normallyLoadedUser.toJSON(), 'password'), false);
});

test('does not hash the password again when an unrelated User field changes', async () => {
  const user = await User.create(validUser());
  const originalHash = user.password;

  user.name = 'Ada Byron';
  await user.save();

  assert.equal(user.password, originalHash);
});

test('persists only a hash of an email-verification token', async () => {
  const user = new User(validUser());
  const token = user.createEmailVerificationToken();

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(user.emailVerificationToken, /^[a-f0-9]{64}$/);
  assert.notEqual(user.emailVerificationToken, token);
  assert.ok(user.emailVerificationTokenExpiresAt instanceof Date);

  await user.save();

  const normallyLoadedUser = await User.findById(user._id);
  assert.equal(normallyLoadedUser.emailVerificationToken, undefined);
  assert.equal(normallyLoadedUser.emailVerificationTokenExpiresAt, undefined);

  const userWithSecurityFields = await User.findById(user._id)
    .select('+emailVerificationToken +emailVerificationTokenExpiresAt');

  assert.equal(
    userWithSecurityFields.emailVerificationToken,
    user.emailVerificationToken
  );
  assert.ok(userWithSecurityFields.emailVerificationTokenExpiresAt instanceof Date);
});
