import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import mongoose from 'mongoose';
import {
  IMAGE_PROCESSING_QUEUE_NAME,
  IMAGE_PROCESSING_JOB_NAME,
  IMAGE_PROCESSING_JOB_OPTIONS,
  imageProcessingQueue,
  enqueueImageProcessingJob,
  closeImageProcessingQueue
} from '../src/queues/image-processing-queue.js';

// we use it to can hold the ID of the created job.
let queuedJob;

// delete the created job after every test
afterEach(async () => {
  if (queuedJob) {
    const storedJob = await imageProcessingQueue.getJob(queuedJob.id);

    if (storedJob) await storedJob.remove();

    queuedJob = undefined;
  }  
});

// close the connections after finish testing
after(async () => { await closeImageProcessingQueue(); });

test(`enqueues the persisted job ID as the complete queue payload`, async () => {
  // create random ID
  const jobId = new mongoose.Types.ObjectId();
  // enqueue it
  queuedJob = await enqueueImageProcessingJob(jobId);
  // a verification we can read back it from Redis
  const storedJob = await imageProcessingQueue.getJob(queuedJob.id);

  // do some verifications
  assert.ok(storedJob);
  assert.equal(imageProcessingQueue.name, IMAGE_PROCESSING_QUEUE_NAME);
  assert.equal(storedJob.name, IMAGE_PROCESSING_JOB_NAME);
  
  assert.deepEqual(storedJob.data, { jobId: jobId.toString() });
  assert.deepEqual(Object.keys(storedJob.data), ['jobId']);
});

test(`applies the approved retry and cleanup policy`, async () => {
  // create random ID
  const jobId = new mongoose.Types.ObjectId();
  // enqueue it
  queuedJob = await enqueueImageProcessingJob(jobId);
  // a verification we can read back it from Redis
  const storedJob = await imageProcessingQueue.getJob(queuedJob.id);

  assert.ok(storedJob);
  assert.equal(
    storedJob.opts.attempts,
    IMAGE_PROCESSING_JOB_OPTIONS.attempts
  );

  assert.deepEqual(
    storedJob.opts.backoff,
    IMAGE_PROCESSING_JOB_OPTIONS.backoff
  );

  assert.deepEqual(
    storedJob.opts.removeOnComplete,
    IMAGE_PROCESSING_JOB_OPTIONS.removeOnComplete
  );

  assert.deepEqual(
    storedJob.opts.removeOnFail,
    IMAGE_PROCESSING_JOB_OPTIONS.removeOnFail
  );
});