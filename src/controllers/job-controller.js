// ─── Import Modules ─────────────────────────────────────────────────────────────

import mongoose from "mongoose";
import Job from '../models/job.js';
import AppError from '../errors/AppError.js';
import { uploadOriginalImage } from '../services/storage.js';
import { deleteOriginalImage } from '../services/storage.js';
import { enqueueImageProcessingJob } from '../queues/image-processing-queue.js';

// ─── Helper Functions ───────────────────────────────────────────────────────────

const createSafeError = error => ({
  name: error instanceof Error ? error.name : 'Error',
  ...(typeof error?.code === 'string' && { code: error.code })
});

const cleanupFailedJobCreation = async ({ jobId, shouldDeleteJob, uploadedImage, log }) => {
  if (shouldDeleteJob) {
    try {
      await Job.deleteOne({ _id : jobId });
    } catch (error) {
      log.error(
        {
          event: 'guestJobCreationCleanupFailed',
          jobId: jobId.toString(),
          cleanupTarget: 'databaseJob',
          failure: createSafeError(error)
        },
        'Failed to cleanup the database job'
      );
    }
  }

  if (uploadedImage) {
    try {
      await deleteOriginalImage(uploadedImage.publicId);
    } catch (error) {
      log.error(
        {
          event: 'guestJobCreationCleanupFailed',
          jobId: jobId.toString(),
          cleanupTarget: 'originalImage',
          failure: createSafeError(error)
        },
        'Failed to remove original image'
      );
    }
  }
};

// ─── POST api/v1/jobs ───────────────────────────────────────────────────────────

export const createGuestJob = async (req, res) => {
  // to can record when the error is happened
  let failureStage;
  let job;
  let inputFile;

  // fetch input data
  const { operation, options } = req.validated.body;

  // we generate ID manually because inside `catch` we use it
  // so if `uploadOriginalImage` thrown an error and we depend
  // on the automatic creation, it will fail because the job is
  // not created yet.
  const jobId = new mongoose.Types.ObjectId();

  try {
    // fetch image and upload it to cloudinary
    failureStage = 'storage';
    inputFile = await uploadOriginalImage(req.file.buffer);

    // create a job
    failureStage = 'persistence';

    job = new Job({
      _id: jobId,
      user: null,
      operation,
      options,
      inputFile
    });

    const guestAccessToken = job.createGuestAccessToken();
    await job.save();

    // create the job
    failureStage = 'queue';
    const queuedJob = await enqueueImageProcessingJob(job._id);

    req.log.info(
      {
        event: 'guestJobCreated',
        jobId: job._id.toString(),
        queueJobId: queuedJob.id?.toString(),
        operation
      },
      'Guest image-processing job created'
    );

    // send the response
    res.location(`/api/v1/jobs/${job._id}`);

    return res.status(202).json({
      status: 'success',
      data: {
        job: {
          id: job._id.toString(),
          operation: job.operation,
          options: job.options,
          status: job.status,
          createdAt: job.createdAt
        },
        guestAccessToken
      }
    });
  } catch (error) {
    const dbWriteWasAttempted = ['persistence', 'queue'].includes(failureStage);

    await cleanupFailedJobCreation({
      jobId,
      shouldDeleteJob: dbWriteWasAttempted,
      uploadedImage: inputFile,
      log: req.log
    });

    req.log.error(
      {
        event: 'guestJobCreationFailed',
        jobId: jobId.toString(),
        operation,
        failureStage,
        failure: createSafeError(error)
      },
      'Guest image-processing job creation failed'
    );

    throw new AppError(
      'The job could not be accepted for processing.',
      503,
      {
        code: 'JOB_CREATION_FAILED'
      }
    );
  }
};
