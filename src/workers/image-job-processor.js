import mongoose from "mongoose";
import logger from '../config/logger.js';
import Job from '../models/job.js';
import processImage from '../image-processing/process-image.js';
import { downloadImage, uploadProcessedImage } from '../storage/cloudinary-storage.js';
import StorageError from "../errors/storage-error.js";

// avoid leaking sensitive data.
const createSafeError = error => ({
  name: error instanceof Error ? error.name : 'Error',
  code: typeof error?.code === 'string' ? error.code : undefined,
  message: error instanceof StorageError ? error.message : 'image processing job failed'
});

// normalize any thrown error not of type `Error` to it.
const normalizeThrownError = error => {
  return error instanceof Error 
    ? error
    : new Error('image processing failed');
};

// in production, this wrapper is not needed.
// we only use it for dependency injection in tests.
const processImageJob = ({
  JobModel = Job,
  downloadOriginalImg = downloadImage,
  processImg = processImage,
  uploadProcessedImg = uploadProcessedImage,
  log = logger
} = {}) => {
  return async queuedJob => {
    const queueJobId = queuedJob?.id?.toString();
    const dbJobId = queuedJob?.data?.jobDBId;
    const attempt = (queuedJob?.attemptsMade ?? 0) + 1;
    const maxAttempts = queuedJob?.opts?.attempts ?? 1;
    const willRetry = attempt < maxAttempts;

    const logContext = {
      queueJobId,
      dbJobId,
      attempt,
      maxAttempts
    };

    // check database ID has a valid format
    // we use the first check because `isObject...()` will bypass the objectId type
    // but we want to enforce that the queue always contain the ID as a string. 
    if (typeof dbJobId !== 'string' || !mongoose.isObjectIdOrHexString(dbJobId)) {
      const error = new Error('A job in the image-processing queue has an invalid database job ID.');

      log.error(
        {
          event: 'imageProcessingFailed',
          ...logContext,
          willRetry,
          failure: {
            name: error.name,
            message: error.message
          }
        },
        'Image processing job failed'
      );

      throw error;
    }

    const dbJob = await JobModel.findById(dbJobId);

    // check this job exists in the database
    if (!dbJob) {
      const error = new Error('Image-processing job was not found in the database');

      log.error(
        {
          event: 'imageProcessingFailed',
          ...logContext,
          willRetry,
          failure: {
            name: error.name,
            message: error.message
          }
        },
        'Image processing job failed'
      );

      throw error;
    }

    // BullMQ may redeliver a job if the worker completed the database
    // update but stopped before acknowledging completion to Redis.
    if (dbJob.status === 'completed') {
      log.info(
        {
          event: 'imageProcessingAlreadyCompleted',
          ...logContext
        },
        "Image processing job was already completed"
      );

      return {
        jobId: dbJobId,
        status: 'completed'
      };
    }

    try {
      dbJob.status = 'processing';
      dbJob.outputFile = undefined;
      dbJob.errorMessage = undefined;

      await dbJob.save();

      log.info(
        {
          event: 'imageProcessingStarted',
          ...logContext,
          operation: dbJob.operation
        },
        'Image processing job started'
      );

      const originalImage = await downloadOriginalImg(
        dbJob.inputFile.secureUrl
      );

      const processedImage = await processImg(
        originalImage,
        dbJob.operation,
        dbJob.options
      );

      const outputFile = await uploadProcessedImg(processedImage);

      dbJob.status = 'completed';
      dbJob.outputFile = { publicId: outputFile.public_id, secureUrl: outputFile.secure_url };
      dbJob.errorMessage = undefined;

      await dbJob.save();

      log.info(
        {
          event: 'imageProcessingCompleted',
          ...logContext,
          operation: dbJob.operation
        },
        'Image processing job completed'
      );

      return {
        jobId: dbJobId,
        status: 'completed'
      };

    } catch (error) {
      const normalizedError = normalizeThrownError(error);

      // BullMQ will stop retrying the job when reach the maximum.
      // we only check `willRetry` to update the database.
      if (!willRetry) {
        dbJob.status = 'failed';
        dbJob.outputFile = undefined;
        dbJob.errorMessage = createSafeError(error).message;

        try {
          await dbJob.save();
        } catch (statusUpdateError) {
          log.error(
            {
              event: 'imageProcessingFailureStatusUpdateFailed',
              ...logContext,
              willRetry: false,
              processingFailure: createSafeError(error),
              statusUpdateFailure: createSafeError(statusUpdateError)
            },
            'Failed to store the final image processing failure in database'
          );

          throw statusUpdateError;
        }
      }

      log.error(
        {
          event: 'imageProcessingFailed',
          ...logContext,
          operation: dbJob.operation,
          willRetry,
          failure: createSafeError(error)
        },
        'Image processing job failed'
      );

      // BullMQ only applies its retry policy when the processor rejects.
      throw normalizedError;
    }
  };
};

export default processImageJob();

// Why we download the original image from Cloudinary
// instead of just keeping it in memory when the API receives it?
//
// 1. At first, we only add the `jobId` to the BullMQ queue and
// when this job gets its turn, the worker downloads the image.
//
// 2. API and worker are separate processes, so the worker can't
// reliably access the image buffer held in the API's memory.
// 
// Also if we kept images in memory and we get many requests at once so
// we would have to keep all of them in memory while they're waiting to
// be processed, so consuming more resources.
//
// So basically, it's a trade-off: use more memory or use more network bandwidth.