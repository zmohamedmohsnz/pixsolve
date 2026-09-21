import express from 'express';
import { parseImageUpload } from '../middleware/parse-image-upload.js';
import { validateImageUpload } from '../middleware/validate-image-upload.js';
import validateRequest from '../middleware/validate-request.js';
import { imageProcessingRequestSchema } from '../validations/image-processing-job.js';
import { createGuestJob, getGuestJob } from '../controllers/image-processing-job-controller.js';

const router = express.Router();

router.post(
  '/',
  parseImageUpload,
  validateImageUpload,
  validateRequest(imageProcessingRequestSchema),
  createGuestJob
);

router.get(
  '/:id',
  getGuestJob
);

export default router;