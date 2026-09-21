import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test, { afterEach, mock } from 'node:test';
import sharp from 'sharp';
import cloudinary from '../src/config/cloudinary.js';
import Job from '../src/models/job.js';
import processImageJob from '../src/workers/image-job-processor.js';

const DATABASE_JOB_ID = '68c78abed5f489c572fcd095';

const createPersistedJob = overrides => {
  const savedStates = [];

  const job = {
    _id: DATABASE_JOB_ID,
    operation: 'resize',
    status: 'pending',
    options: { width: 100, height: 100 },
    inputFile: {
      publicId: 'pixsolve/originals/worker-test',
      secureUrl:
        'https://res.cloudinary.com/test/image/upload/worker-test.jpg'
    },
    outputFile: undefined,
    errorMessage: undefined,
    ...overrides,

    async save() {
      savedStates.push({
        status: this.status,
        outputFile: this.outputFile,
        errorMessage: this.errorMessage
      });

      return this;
    }
  };

  return { job, savedStates };
};

const createQueueJob = ({ attemptsMade = 0, attempts = 3 } = {}) => ({
  id: 'bullmq-worker-test',
  data: { jobDBId: DATABASE_JOB_ID },
  attemptsMade,
  opts: { attempts }
});

afterEach(() => {
  mock.restoreAll();
});

test('processes an image and stores the completed job metadata', async () => {
  const inputImage = await sharp({
    create: {
      width: 200,
      height: 120,
      channels: 3,
      background: { r: 30, g: 90, b: 160 }
    }
  })
    .jpeg()
    .toBuffer();

  const { job, savedStates } = createPersistedJob();
  let uploadedImage;

  mock.method(Job, 'findById', async receivedId => {
    assert.equal(receivedId, DATABASE_JOB_ID);
    return job;
  });

  mock.method(globalThis, 'fetch', async receivedUrl => {
    assert.equal(receivedUrl, job.inputFile.secureUrl);
    assert.equal(job.status, 'processing');

    return new Response(inputImage, { status: 200 });
  });

  mock.method(
    cloudinary.uploader,
    'upload_stream',
    (_options, callback) => {
      return new Writable({
        write(chunk, _encoding, done) {
          uploadedImage = Buffer.from(chunk);

          callback(null, {
            public_id: 'pixsolve/processed/worker-test',
            secure_url:
              'https://res.cloudinary.com/test/image/upload/worker-output.jpg'
          });

          done();
        }
      });
    }
  );

  const result = await processImageJob(createQueueJob());
  const outputMetadata = await sharp(uploadedImage).metadata();

  assert.deepEqual(result, {
    jobId: DATABASE_JOB_ID,
    status: 'completed'
  });

  assert.equal(outputMetadata.width, 100);
  assert.equal(outputMetadata.height, 100);
  assert.equal(outputMetadata.format, 'jpeg');

  assert.deepEqual(
    savedStates.map(state => state.status),
    ['processing', 'completed']
  );

  assert.deepEqual(job.outputFile, {
    publicId: 'pixsolve/processed/worker-test',
    secureUrl:
      'https://res.cloudinary.com/test/image/upload/worker-output.jpg'
  });

  assert.equal(job.errorMessage, undefined);
});

test('stores a safe error after the final failed attempt', async () => {
  const { job, savedStates } = createPersistedJob();

  mock.method(Job, 'findById', async () => job);
  mock.method(globalThis, 'fetch', async () => {
    return new Response(null, { status: 503 });
  });

  await assert.rejects(
    processImageJob(createQueueJob({ attemptsMade: 2, attempts: 3 })),
    {
      name: 'StorageError',
      code: 'STORAGE_DOWNLOAD_FAILED',
      message: 'Failed to download image'
    }
  );

  assert.deepEqual(
    savedStates.map(state => state.status),
    ['processing', 'failed']
  );

  assert.equal(job.status, 'failed');
  assert.equal(
    job.errorMessage,
    'Failed to download image'
  );
  assert.equal(job.outputFile, undefined);
});

test('keeps the job processing while BullMQ has another attempt', async () => {
  const { job, savedStates } = createPersistedJob();

  mock.method(Job, 'findById', async () => job);
  mock.method(globalThis, 'fetch', async () => {
    return new Response(null, { status: 503 });
  });

  await assert.rejects(
    processImageJob(createQueueJob({ attemptsMade: 0, attempts: 3 }))
  );

  assert.deepEqual(
    savedStates.map(state => state.status),
    ['processing']
  );

  assert.equal(job.status, 'processing');
  assert.equal(job.errorMessage, undefined);
  assert.equal(job.outputFile, undefined);
});

test('does not process an already completed database job again', async () => {
  const { job, savedStates } = createPersistedJob({
    status: 'completed',
    outputFile: {
      publicId: 'pixsolve/processed/existing-output',
      secureUrl:
        'https://res.cloudinary.com/test/image/upload/existing-output.jpg'
    }
  });

  mock.method(Job, 'findById', async () => job);
  mock.method(globalThis, 'fetch', async () => {
    assert.fail('An already completed job must not be downloaded again');
  });

  const result = await processImageJob(createQueueJob());

  assert.deepEqual(result, {
    jobId: DATABASE_JOB_ID,
    status: 'completed'
  });

  assert.deepEqual(savedStates, []);
});
