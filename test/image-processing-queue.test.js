import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import mongoose from 'mongoose';
import {
  imageProcessingQueueName,
  imageProcessingJobName,
  defaultJobOptions,
  imageProcessingQueue,
  enqueueImageProcessingJob,
  shutdownImageProcessingQueue
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
after(async () => { await shutdownImageProcessingQueue(); });

test(`enqueues the persisted job ID as the complete queue payload`, async () => {
  // create random ID
  const jobId = new mongoose.Types.ObjectId();
  // enqueue it
  queuedJob = await enqueueImageProcessingJob(jobId);
  // a verification we can read back it from Redis
  const storedJob = await imageProcessingQueue.getJob(queuedJob.id);

  // do some verifications
  assert.ok(storedJob);
  assert.equal(imageProcessingQueue.name, imageProcessingQueueName);
  assert.equal(storedJob.name, imageProcessingJobName);
  assert.equal(storedJob.id, `db-job-${jobId}`);
  
  assert.deepEqual(storedJob.data, { jobDBId: jobId.toString() });
  assert.deepEqual(Object.keys(storedJob.data), ['jobDBId']);
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
    defaultJobOptions.attempts
  );

  assert.deepEqual(
    storedJob.opts.backoff,
    defaultJobOptions.backoff
  );

  assert.deepEqual(
    storedJob.opts.removeOnComplete,
    defaultJobOptions.removeOnComplete
  );

  assert.deepEqual(
    storedJob.opts.removeOnFail,
    defaultJobOptions.removeOnFail
  );
});
