import express from 'express';
import validateRequest from '../middleware/validate-request.js';
import { signupSchema, verifyEmailSchema } from '../validations/auth.js';
import { signup, verifyEmail } from '../controllers/auth-controller.js';

const router = new express.Router();

router.post(
  '/signup',
  validateRequest(signupSchema),
  signup
);

router.get(
  '/verify-email/:token',
  validateRequest(verifyEmailSchema),
  verifyEmail
);

export default router;