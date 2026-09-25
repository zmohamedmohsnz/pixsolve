import express from 'express';
import validateRequest from '../middleware/validate-request.js';
import {
  signupSchema,
  loginSchema,
  verifyEmailSchema
} from '../validations/auth.js';

import {
  signup,
  login,
  verifyEmail
} from '../controllers/auth-controller.js';

const router = new express.Router();

router.post(
  '/signup',
  validateRequest(signupSchema),
  signup
);

router.post(
  '/login',
  validateRequest(loginSchema),
  login
);

router.post(
  '/verify-email',
  validateRequest(verifyEmailSchema),
  verifyEmail
);

export default router;
