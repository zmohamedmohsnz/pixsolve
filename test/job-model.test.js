import assert from 'node:assert/strict';
import test, {
  after,
  before,
  beforeEach
} from 'node:test';
import mongoose from 'mongoose';
import config from '../src/config/env.js';
import connectToDB from '../src/config/database.js';
import Job from '../src/models/job.js';

const createValidJobData = overrides => ({
  operation: 'resize',

  options: {
    width: 800,
    height: 600
  },

  inputFile: {
    publicId: 'pixsolve/original/example',
    secureUrl: 'https://res.cloudinary.com/example/image/upload/example.jpg'
  },

  ...overrides
});

const assertValidationError = async (
  jobData,
  expectedPath
) => {
  await assert.rejects(
    Job.create(jobData),
    error => {
      assert.equal(error.name, 'ValidationError');
      assert.ok(error.errors[expectedPath]);

      return true;
    }
  );
};

before(async () => {
  // don't worry dotenv don't override by default so it will not
  // override what `setup-env.js` set with that in `.env` file.
  await connectToDB(config.dbUri);
});

beforeEach(async () => {
  await Job.deleteMany({});
});

after(async () => {
  await Job.deleteMany({});

  // without it, the opened connection may keep Node's event
  // loop active, causing test process to wait or hang
  await mongoose.disconnect();
});

test('persists a valid pending guest job with the default status', async () => {
  const job = await Job.create(createValidJobData());

  assert.ok(job._id);
  assert.equal(job.user, null);
  assert.equal(job.operation, 'resize');
  assert.equal(job.status, 'pending');

  assert.deepEqual(job.options, {
    width: 800,
    height: 600
  });

  assert.equal(
    job.inputFile.publicId,
    'pixsolve/original/example'
  );

  assert.equal(
    job.inputFile.secureUrl,
    'https://res.cloudinary.com/example/image/upload/example.jpg'
  );

  assert.equal(job.outputFile, undefined);
  assert.equal(job.errorMessage, undefined);
  assert.ok(job.createdAt instanceof Date);
  assert.ok(job.updatedAt instanceof Date);

  const persistedJob = await Job.findById(job._id);

  assert.ok(persistedJob);
  assert.equal(persistedJob.user, null);
  assert.equal(persistedJob.status, 'pending');
});

test('persists a processing job without output or error metadata', async () => {
  const job = await Job.create(
    createValidJobData({
      operation: 'compress',
      options: {
        quality: 70
      },
      status: 'processing'
    })
  );

  assert.equal(job.status, 'processing');
  assert.equal(job.outputFile, undefined);
  assert.equal(job.errorMessage, undefined);
});

test('persists a completed job when output metadata is provided', async () => {
  const job = await Job.create(
    createValidJobData({
      operation: 'convert',
      options: {
        format: 'webp'
      },
      status: 'completed',
      outputFile: {
        publicId: 'pixsolve/processed/example',
        secureUrl:
          'https://res.cloudinary.com/example/image/upload/example.webp'
      }
    })
  );

  assert.equal(job.status, 'completed');

  assert.equal(
    job.outputFile.publicId,
    'pixsolve/processed/example'
  );

  assert.equal(
    job.outputFile.secureUrl,
    'https://res.cloudinary.com/example/image/upload/example.webp'
  );
});

test('persists a failed job when an error message is provided', async () => {
  const job = await Job.create(
    createValidJobData({
      status: 'failed',
      errorMessage: 'Image processing failed'
    })
  );

  assert.equal(job.status, 'failed');
  assert.equal(job.errorMessage, 'Image processing failed');
  assert.equal(job.outputFile, undefined);
});

test('rejects an unsupported operation', async () => {
  await assertValidationError(
    createValidJobData({
      operation: 'rotate',
      options: {
        angle: 90
      }
    }),
    'operation'
  );
});

test('rejects an unsupported status', async () => {
  await assertValidationError(
    createValidJobData({
      status: 'queued'
    }),
    'status'
  );
});

test('rejects a completed job without output metadata', async () => {
  await assertValidationError(
    createValidJobData({
      status: 'completed'
    }),
    'outputFile'
  );
});

test('rejects a failed job without an error message', async () => {
  await assertValidationError(
    createValidJobData({
      status: 'failed'
    }),
    'errorMessage'
  );
});