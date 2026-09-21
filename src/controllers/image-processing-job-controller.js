// ─── Import Modules ─────────────────────────────────────────────────────────────

import mongoose from "mongoose";
import Job from '../models/job.js';
import ApiError from '../errors/api-error.js';
import { uploadOriginalImage, deleteImage } from '../storage/cloudinary-storage.js';
import { enqueueImageProcessingJob } from '../queues/image-processing-queue.js';

// ─── Helper Functions ───────────────────────────────────────────────────────────

const createSafeError = error => ({
  name: error instanceof Error ? error.name : 'Error',
  ...(typeof error?.code === 'string' && { code: error.code })
});

const cleanupFailedJobCreation = async ({ jobId, isDocumentCreated, uploadedImage, queuedJob, log }) => {
  const logCleanupFailure = (cleanupTarget, error) => {
    log.error(
      {
        event: 'guestJobCreationCleanupFailed',
        jobId,
        cleanupTarget,
        failure: createSafeError(error)
      },
      'Failed to cleanup'
    );
  }

  if (isDocumentCreated) {
    try {
      await Job.deleteOne({ _id : jobId});
    } catch (error) {
      logCleanupFailure('databaseJob', error);
    }
  }

  if (uploadedImage) {
    try {
      await deleteImage(uploadedImage.public_id);
    } catch (error) {
      logCleanupFailure('originalImage', error);
    }
  }

  if (queuedJob) {
    try {
      await queuedJob.remove();
    } catch (error) {
      logCleanupFailure('queuedJob', error);
    }
  }
};

// ─── POST api/v1/image-processing/jobs ──────────────────────────────────────────

export const createGuestJob = async (req, res) => {
  // specify where the error is happened
  let failureStage;

  // define outside `try` because they are used in `catch`
  let inputImage, operation, options, queuedJob;

  // create the jobId manually to make it distinguish the job
  // during all its stages, not only the database stage.
  const jobId = new mongoose.Types.ObjectId();

  try {
    // 1) fetch input data
    ({ operation, options } = req.validatedData.body);

    failureStage = 'storage';

    // 2) upload the original image to cloudinary
    inputImage = await uploadOriginalImage(req.file.buffer);

    failureStage = 'database';

    // 3) create a job in the database
    const job = new Job({
      _id: jobId,
      user: null,
      operation,
      options,
      inputFile: {
        publicId: inputImage.public_id,
        secureUrl: inputImage.secure_url
      }
    });

    const guestAccessToken = job.createGuestAccessToken();
    await job.save();

    failureStage = 'queue';
    
    // 4) enqueue the job
    queuedJob = await enqueueImageProcessingJob(job._id);

    failureStage = 'logging';

    // 5) log a job is created successfully
    req.log.info(
      {
        event: 'guestImageProcessingJobCreated',
        jobId,
        queuedJobId: queuedJob.id?.toString(),
        operation
      },
      'A guest image-processing job is created'
    );

    failureStage = 'response';

    // 6) send the response
    res.location(`/api/v1/image-processing/jobs/${job._id}`);
    return res.status(202).json({
      status: 'success',
      data: {
        job: {
          id: jobId,
          operation: job.operation,
          options: job.options,
          status: job.status,
          createdAt: job.createdAt
        },
        guestAccessToken
      }
    });
  } catch (error) {
    await cleanupFailedJobCreation({
      jobId,
      isDocumentCreated: failureStage !== 'storage' && failureStage !== undefined,
      uploadedImage: inputImage,
      queuedJob,
      log: req.log
    });

    req.log.error(
      {
        event: 'guestImageProcessingJobCreationFailed',
        jobId: jobId.toString(),
        operation,
        failureStage,
        failure: createSafeError(error)
      },
      'Guest image-processing job creation failed'
    );

    throw new ApiError(
      'The job could not be accepted for processing.', 503,
      { code: 'JOB_CREATION_FAILED' }
    );
  }
};
