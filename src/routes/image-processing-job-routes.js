import express from 'express';
import { parseImageUpload } from '../middleware/parse-image-upload.js';
import { validateImageUpload } from '../middleware/validate-image-upload.js';
import validateRequest from '../middleware/validate-request.js';
import authenticate from '../middleware/authenticate.js';
import { imageProcessingRequestSchema } from '../validations/image-processing-job.js';
import { createJob, getJob } from '../controllers/image-processing-job-controller.js';

const router = express.Router();

router.post(
  '/',
  authenticate({ optional: true }),
  parseImageUpload,
  validateImageUpload,
  validateRequest(imageProcessingRequestSchema),
  createJob
);

router.get(
  '/:id',
  authenticate({ optional: true }),
  getJob
);

export default router;