// ─── Import Modules ─────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
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
        event: 'imageProcessingJobCreationCleanupFailed',
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

const createJobNotFoundError = () => {
  return new ApiError(
    'Job not found',
    404,
    { code: 'JOB_NOT_FOUND' }
  );
};

// ─── POST api/v1/image-processing/jobs ──────────────────────────────────────────

export const createJob = async (req, res) => {
  // to specify where and when the error is happened
  let failureStage;

  // define outside `try` because they are used in `catch`
  let inputImage, operation, options, queuedJob;

  // create the job id manually to make it distinguish the job
  // during all its stages, not only the database stage.
  const jobId = new mongoose.Types.ObjectId();

  // fetch the user from the request if exists
  const userId = req.user?.id ?? null;

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
      user: userId,
      operation,
      options,
      inputFile: {
        publicId: inputImage.public_id,
        secureUrl: inputImage.secure_url
      }
    });

    const guestAccessToken = userId ? undefined : job.createGuestAccessToken();
    await job.save();

    failureStage = 'queue';
    
    // 4) enqueue the job
    queuedJob = await enqueueImageProcessingJob(job._id);

    failureStage = 'logging';

    // 5) log a job is created successfully
    req.log.info(
      {
        event: 'imageProcessingJobCreated',
        jobId: jobId.toString(),
        userId: userId ? userId.toString() : undefined,
        queuedJobId: queuedJob.id?.toString(),
        operation
      },
      'image-processing job is created'
    );

    failureStage = 'response';

    // 6) send the response
    const responseData = {
      job: {
        id: job._id.toString(),
        operation: job.operation,
        options: job.options,
        status: job.status,
        createdAt: job.createdAt,
      },
      ...( !userId && { guestAccessToken })
    };

    res.location(`/api/v1/image-processing/jobs/${job._id}`);
    return res.status(202).json({
      status: 'success',
      data: responseData
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
        event: 'imageProcessingJobCreationFailed',
        jobId: jobId.toString(),
        userId: userId ? userId.toString() : undefined,
        creationMode: userId ? 'authenticated' : 'guest',
        operation,
        failureStage,
        failure: createSafeError(error)
      },
      'Image-processing job creation failed'
    );

    throw new ApiError(
      'The job could not be accepted for processing.',
      503,
      { code: 'JOB_CREATION_FAILED' }
    );
  }
};

// ─── GET api/v1/image-processing/jobs ───────────────────────────────────────────

export const getGuestJob = async (req, res) => {
  // 1) fetch the access token and the job id
  const guestAccessToken = req.get('X-Guest-Access-Token');
  const jobId = req.params.id;

  if (typeof guestAccessToken !== 'string' || guestAccessToken.trim() === '') {
    throw new ApiError(
      'Guest access token is required.',
      401,
      { code: 'GUEST_ACCESS_TOKEN_REQUIRED' }
    );
  }

  // 2) validate the access token and the job ID formats before
  // trying to find the document because invalid job ID format
  // may cause `CastError`, but we wanna just return `null`,
  // and for the token, we reject the obviously malformed input early
  // instead of unnecessarily hashing it and querying the database. 
  const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
  if (!mongoose.isObjectIdOrHexString(jobId) || !tokenPattern.test(guestAccessToken)) {
    throw createJobNotFoundError();
  }

  // 3) try to fetch the job from the database
  const guestAccessTokenHash = createHash('sha256')
    .update(guestAccessToken)
    .digest('hex');

  const job = await Job.findOne({
    _id: jobId,
    user: null,
    guestAccessTokenHash
  })
    .select('_id operation options status outputFile.secureUrl ' + 
      'errorMessage createdAt updatedAt'
    )
    .lean();

  if (!job) {
    throw createJobNotFoundError();
  }

  // 4) return the response
  const responseJob = {
    id: job._id.toString(),
    operation: job.operation,
    options: job.options,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };

  if (job.status === 'completed') {
    responseJob.result = { downloadUrl: job.outputFile.secureUrl };
  }

  if (job.status === 'failed') {
    responseJob.error = { message: job.errorMessage };
  }

  return res.status(200).json({
    status: 'success',
    data: { job: responseJob }
  });
};