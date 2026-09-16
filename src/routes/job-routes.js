import express from 'express';
import parseSingleImageUpload from '../middleware/image-upload.js';
import validateUploadedImage from '../middleware/validate-uploaded-image.js';
import validate from '../middleware/validate.js';
import { jobOperationRequestSchema } from '../validations/job-operations.js';
import { createGuestJob } from '../controllers/job-controller.js';

const router = express.Router();

router.post(
  '/',
  parseSingleImageUpload,
  validateUploadedImage,
  validate(jobOperationRequestSchema),
  createGuestJob
);

export default router;