import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import test, { after, afterEach, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';
import cloudinary from '../src/config/cloudinary.js';
import config from '../src/config/env.js';
import Job from '../src/models/job.js';
import User from '../src/models/user.js';
import {
  imageProcessingQueue,
  shutdownImageProcessingQueue
} from '../src/queues/image-processing-queue.js';

const PNG_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
  'base64'
);

const INPUT_FILE = {
  publicId: 'pixsolve/originals/guest-creation-test',
  secureUrl:
    'https://res.cloudinary.com/test/image/upload/guest-creation-test.png'
};

const USER_ID = '507f1f77bcf86cd799439011';
const OTHER_USER_ID = '507f191e810c19729de860ea';

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await shutdownImageProcessingQueue();
});

const mockSuccessfulCloudinaryUpload = () => {
  let receivedBuffer;

  mock.method(
    cloudinary.uploader,
    'upload_stream',
    (_options, callback) => {
      return new Writable({
        write(chunk, _encoding, done) {
          receivedBuffer = Buffer.from(chunk);

          callback(null, {
            public_id: INPUT_FILE.publicId,
            secure_url: INPUT_FILE.secureUrl
          });

          done();
        }
      });
    }
  );

  return () => receivedBuffer;
};

const sendValidRequest = () => {
  return request(app)
    .post('/api/v1/image-processing/jobs')
    .field('operation', 'resize')
    .field(
      'options',
      JSON.stringify({ width: 800, height: 600 })
    )
    .attach('image', PNG_IMAGE, {
      filename: 'original.png',
      contentType: 'image/png'
    });
};

const signAccessToken = (payload = {}, options = {}) => jwt.sign(
  payload,
  config.jwt.accessTokenSecret,
  {
    algorithm: 'HS256',
    subject: USER_ID,
    expiresIn: 60,
    ...options
  }
);

const authenticateUser = ({ passwordChangedAt = null } = {}) => {
  mock.method(User, 'findById', async id => ({
    _id: id,
    isActive: true,
    passwordChangedAt
  }));
};

test('accepts a valid guest image-processing job', async () => {
  const getUploadedBuffer = mockSuccessfulCloudinaryUpload();
  let savedJob;

  mock.method(Job.prototype, 'save', async function() {
    savedJob = this;
    this.createdAt = new Date('2026-09-15T10:00:00.000Z');
    this.updatedAt = this.createdAt;
    return this;
  });

  mock.method(
    imageProcessingQueue,
    'add',
    async (_name, _data, options) => ({ id: options.jobId })
  );

  const response = await sendValidRequest();

  assert.equal(response.status, 202);
  assert.equal(
    response.headers.location,
    `/api/v1/image-processing/jobs/${savedJob._id}`
  );

  assert.deepEqual(response.body, {
    status: 'success',
    data: {
      job: {
        id: savedJob._id.toString(),
        operation: 'resize',
        options: { width: 800, height: 600 },
        status: 'pending',
        createdAt: '2026-09-15T10:00:00.000Z'
      },
      guestAccessToken: response.body.data.guestAccessToken
    }
  });

  assert.deepEqual(getUploadedBuffer(), PNG_IMAGE);
  assert.equal(savedJob.user, null);
  assert.equal(savedJob.operation, 'resize');
  assert.deepEqual(savedJob.options, {
    width: 800,
    height: 600
  });
  assert.deepEqual(savedJob.inputFile.toObject(), INPUT_FILE);

  const guestAccessToken = response.body.data.guestAccessToken;
  assert.match(guestAccessToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(
    savedJob.guestAccessTokenHash,
    createHash('sha256').update(guestAccessToken).digest('hex')
  );

  assert.equal(Job.prototype.save.mock.callCount(), 1);

  assert.equal(imageProcessingQueue.add.mock.callCount(), 1);

  const queueCall = imageProcessingQueue.add.mock.calls[0];
  assert.deepEqual(queueCall.arguments[1], {
    jobDBId: savedJob._id.toString()
  });
  assert.deepEqual(queueCall.arguments[2], {
    jobId: `db-job-${savedJob._id}`
  });
});

test('accepts an authenticated image-processing job without a guest credential', async () => {
  mockSuccessfulCloudinaryUpload();
  authenticateUser();
  let savedJob;

  mock.method(Job.prototype, 'save', async function() {
    savedJob = this;
    this.createdAt = new Date('2026-09-26T10:00:00.000Z');
    this.updatedAt = this.createdAt;
    return this;
  });

  mock.method(
    imageProcessingQueue,
    'add',
    async (_name, _data, options) => ({ id: options.jobId })
  );

  const response = await sendValidRequest()
    .set('Authorization', `Bearer ${signAccessToken()}`);

  assert.equal(response.status, 202);
  assert.equal(
    response.headers.location,
    `/api/v1/image-processing/jobs/${savedJob._id}`
  );
  assert.deepEqual(response.body, {
    status: 'success',
    data: {
      job: {
        id: savedJob._id.toString(),
        operation: 'resize',
        options: { width: 800, height: 600 },
        status: 'pending',
        createdAt: '2026-09-26T10:00:00.000Z'
      }
    }
  });

  assert.equal(savedJob.user.toString(), USER_ID);
  assert.equal(savedJob.guestAccessTokenHash, undefined);
  assert.equal(imageProcessingQueue.add.mock.callCount(), 1);
});

test('rejects an attempted owner injection before side effects', async () => {
  authenticateUser();

  mock.method(cloudinary.uploader, 'upload_stream', () => {
    assert.fail('Owner injection must not upload an image');
  });
  mock.method(Job.prototype, 'save', async () => {
    assert.fail('Owner injection must not create a job');
  });
  mock.method(imageProcessingQueue, 'add', async () => {
    assert.fail('Owner injection must not enqueue a job');
  });

  const response = await sendValidRequest()
    .field('user', OTHER_USER_ID)
    .set('Authorization', `Bearer ${signAccessToken()}`);

  assert.equal(response.status, 422);
  assert.equal(response.body.code, 'VALIDATION_ERROR');
  assert.equal(Job.prototype.save.mock.callCount(), 0);
  assert.equal(imageProcessingQueue.add.mock.callCount(), 0);
});

test('rejects invalid supplied authentication before upload parsing and side effects', async () => {
  mock.method(cloudinary.uploader, 'upload_stream', () => {
    assert.fail('Invalid authentication must not upload an image');
  });
  mock.method(Job.prototype, 'save', async () => {
    assert.fail('Invalid authentication must not create a job');
  });
  mock.method(imageProcessingQueue, 'add', async () => {
    assert.fail('Invalid authentication must not enqueue a job');
  });

  const response = await sendValidRequest()
    .set('Authorization', 'Bearer invalid-token');

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'INVALID_ACCESS_TOKEN');
  assert.equal(Job.prototype.save.mock.callCount(), 0);
  assert.equal(imageProcessingQueue.add.mock.callCount(), 0);
});

test('rejects a password-invalidated token before job-creation side effects', async () => {
  const issuedAt = Math.floor(Date.now() / 1000) - 10;
  authenticateUser({ passwordChangedAt: new Date() });

  mock.method(cloudinary.uploader, 'upload_stream', () => {
    assert.fail('Invalidated authentication must not upload an image');
  });
  mock.method(Job.prototype, 'save', async () => {
    assert.fail('Invalidated authentication must not create a job');
  });
  mock.method(imageProcessingQueue, 'add', async () => {
    assert.fail('Invalidated authentication must not enqueue a job');
  });

  const response = await sendValidRequest()
    .set(
      'Authorization',
      `Bearer ${signAccessToken({ iat: issuedAt })}`
    );

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'PASSWORD_CHANGED');
  assert.equal(Job.prototype.save.mock.callCount(), 0);
  assert.equal(imageProcessingQueue.add.mock.callCount(), 0);
});

test('does not accept an authenticated job when storage fails', async () => {
  authenticateUser();

  mock.method(
    cloudinary.uploader,
    'upload_stream',
    (_options, callback) => new Writable({
      write(_chunk, _encoding, done) {
        callback(new Error('Cloudinary unavailable'));
        done();
      }
    })
  );
  mock.method(Job.prototype, 'save', async () => {
    assert.fail('A storage failure must not create a job');
  });
  mock.method(imageProcessingQueue, 'add', async () => {
    assert.fail('A storage failure must not enqueue a job');
  });

  const response = await sendValidRequest()
    .set('Authorization', `Bearer ${signAccessToken()}`);

  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'JOB_CREATION_FAILED');
  assert.equal(Job.prototype.save.mock.callCount(), 0);
  assert.equal(imageProcessingQueue.add.mock.callCount(), 0);
});

test('compensates an authenticated job when persistence fails', async () => {
  mockSuccessfulCloudinaryUpload();
  authenticateUser();
  let attemptedJob;

  mock.method(Job.prototype, 'save', async function() {
    attemptedJob = this;
    throw new Error('MongoDB unavailable');
  });
  mock.method(Job, 'deleteOne', async () => ({
    acknowledged: true,
    deletedCount: 0
  }));
  mock.method(cloudinary.uploader, 'destroy', async () => ({ result: 'ok' }));
  mock.method(imageProcessingQueue, 'add', async () => {
    assert.fail('A persistence failure must not enqueue a job');
  });

  const response = await sendValidRequest()
    .set('Authorization', `Bearer ${signAccessToken()}`);

  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'JOB_CREATION_FAILED');
  assert.equal(attemptedJob.user.toString(), USER_ID);
  assert.equal(attemptedJob.guestAccessTokenHash, undefined);
  assert.equal(Job.deleteOne.mock.callCount(), 1);
  assert.equal(cloudinary.uploader.destroy.mock.callCount(), 1);
  assert.equal(imageProcessingQueue.add.mock.callCount(), 0);
});

test('compensates an authenticated job when queueing fails', async () => {
  mockSuccessfulCloudinaryUpload();
  authenticateUser();
  let savedJob;

  mock.method(Job.prototype, 'save', async function() {
    savedJob = this;
    this.createdAt = new Date('2026-09-26T10:00:00.000Z');
    this.updatedAt = this.createdAt;
    return this;
  });
  mock.method(Job, 'deleteOne', async () => ({
    acknowledged: true,
    deletedCount: 1
  }));
  mock.method(cloudinary.uploader, 'destroy', async () => ({ result: 'ok' }));
  mock.method(imageProcessingQueue, 'add', async () => {
    throw new Error('Redis unavailable');
  });

  const response = await sendValidRequest()
    .set('Authorization', `Bearer ${signAccessToken()}`);

  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'JOB_CREATION_FAILED');
  assert.equal(savedJob.user.toString(), USER_ID);
  assert.equal(savedJob.guestAccessTokenHash, undefined);
  assert.equal(Job.deleteOne.mock.callCount(), 1);
  assert.equal(cloudinary.uploader.destroy.mock.callCount(), 1);
});

test('rejects invalid operation data before external work begins', async () => {
  mock.method(cloudinary.uploader, 'upload_stream', () => {
    assert.fail('Validation failure must not upload an image');
  });

  mock.method(Job.prototype, 'save', async () => {
    assert.fail('Validation failure must not save a database job');
  });

  mock.method(imageProcessingQueue, 'add', async () => {
    assert.fail('Validation failure must not enqueue a job');
  });

  const response = await request(app)
    .post('/api/v1/image-processing/jobs')
    .field('operation', 'rotate')
    .field('options', JSON.stringify({ angle: 90 }))
    .attach('image', PNG_IMAGE, {
      filename: 'original.png',
      contentType: 'image/png'
    });

  assert.equal(response.status, 422);
  assert.equal(response.body.code, 'VALIDATION_ERROR');
  assert.equal(Job.prototype.save.mock.callCount(), 0);
  assert.equal(imageProcessingQueue.add.mock.callCount(), 0);
});

test('does not report acceptance when storage fails', async () => {
  mock.method(
    cloudinary.uploader,
    'upload_stream',
    (_options, callback) => {
      return new Writable({
        write(_chunk, _encoding, done) {
          callback(new Error('Cloudinary unavailable'));
          done();
        }
      });
    }
  );

  mock.method(Job.prototype, 'save', async () => {
    assert.fail('A storage failure must not persist a job');
  });

  mock.method(imageProcessingQueue, 'add', async () => {
    assert.fail('A storage failure must not enqueue a job');
  });

  const response = await sendValidRequest();

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'JOB_CREATION_FAILED',
    message: 'The job could not be accepted for processing.'
  });
  assert.equal(Job.prototype.save.mock.callCount(), 0);
  assert.equal(imageProcessingQueue.add.mock.callCount(), 0);
});

test('deletes the original image when persistence fails', async () => {
  mockSuccessfulCloudinaryUpload();

  mock.method(Job.prototype, 'save', async () => {
    throw new Error('MongoDB unavailable');
  });

  mock.method(Job, 'deleteOne', async () => ({
    acknowledged: true,
    deletedCount: 0
  }));

  mock.method(cloudinary.uploader, 'destroy', async () => ({
    result: 'ok'
  }));

  mock.method(imageProcessingQueue, 'add', async () => {
    assert.fail('A persistence failure must not enqueue a job');
  });

  const response = await sendValidRequest();

  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'JOB_CREATION_FAILED');
  assert.equal(imageProcessingQueue.add.mock.callCount(), 0);
  assert.equal(Job.deleteOne.mock.callCount(), 1);
  assert.equal(cloudinary.uploader.destroy.mock.callCount(), 1);
});

test('deletes the database job and original image when queueing fails', async () => {
  mockSuccessfulCloudinaryUpload();
  let savedJob;

  mock.method(Job.prototype, 'save', async function() {
    savedJob = this;
    this.createdAt = new Date('2026-09-15T10:00:00.000Z');
    this.updatedAt = this.createdAt;
    return this;
  });

  mock.method(Job, 'deleteOne', async () => ({
    acknowledged: true,
    deletedCount: 1
  }));

  mock.method(cloudinary.uploader, 'destroy', async () => ({
    result: 'ok'
  }));

  mock.method(imageProcessingQueue, 'add', async () => {
    throw new Error('Redis unavailable');
  });

  const response = await sendValidRequest();

  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'JOB_CREATION_FAILED');
  assert.equal(Job.deleteOne.mock.callCount(), 1);
  assert.equal(cloudinary.uploader.destroy.mock.callCount(), 1);

  assert.deepEqual(
    Job.deleteOne.mock.calls[0].arguments[0],
    { _id: savedJob._id }
  );
});

test('keeps the approved response when compensation also fails', async () => {
  mockSuccessfulCloudinaryUpload();

  mock.method(Job.prototype, 'save', async function() {
    this.createdAt = new Date('2026-09-15T10:00:00.000Z');
    this.updatedAt = this.createdAt;
    return this;
  });

  mock.method(Job, 'deleteOne', async () => {
    throw new Error('MongoDB cleanup unavailable');
  });

  mock.method(cloudinary.uploader, 'destroy', async () => {
    throw new Error('Cloudinary cleanup unavailable');
  });

  mock.method(imageProcessingQueue, 'add', async () => {
    throw new Error('Redis unavailable');
  });

  const response = await sendValidRequest();

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'JOB_CREATION_FAILED',
    message: 'The job could not be accepted for processing.'
  });

  assert.equal(Job.deleteOne.mock.callCount(), 1);
  assert.equal(cloudinary.uploader.destroy.mock.callCount(), 1);
});
