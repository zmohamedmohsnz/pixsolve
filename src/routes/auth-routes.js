import express from 'express';
import validateRequest from '../middleware/validate-request.js';
import {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  forgetPasswordSchema,
  resetPasswordSchema
} from '../validations/auth.js';

import {
  signup,
  login,
  verifyEmail,
  forgetPassword,
  resetPassword
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
  '/forgot-password',
  validateRequest(forgetPasswordSchema),
  forgetPassword
);

router.patch(
  '/reset-password',
  validateRequest(resetPasswordSchema),
  resetPassword
);

router.post(
  '/verify-email',
  validateRequest(verifyEmailSchema),
  verifyEmail
);

export default router;
