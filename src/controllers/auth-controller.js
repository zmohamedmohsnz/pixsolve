// ─── Import Modules ───────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import User from '../models/user.js';
import { sendVerificationEmail } from '../services/email-service.js';
import ApiError from '../errors/api-error.js';
import config from '../config/env.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────────

const invalidVerificationTokenError = () => new ApiError(
  'Token is invalid or has expired',
  400,
  { code: 'INVALID_TOKEN' }
);

const createSendVerificationEmail = async (req, user) => {
  // 1) create the token
  const token = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // 2) create the verification url and send the email
  try {
    const verificationUrl = `${config.publicApiUrl}/api/v1/auth/verify-email/${token}`;
    await sendVerificationEmail(user.email, verificationUrl);
  } catch (error) {
    // we catch only to do some cleanup, but error is already ApiError
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiresAt = undefined;
    await user.save({ validateBeforeSave: false });
    
    throw error;
  }
};

// ─── POST api/v1/auth/signup ──────────────────────────────────────────────────────

export const signup = async (req, res) => {
  // 1) create a new user
  const { name, email, password } = req.validatedData.body;
  const user = await User.create({ name, email, password });

  if (!user) {
    throw new ApiError('User could not be created.', 500);
  }

  // 2) log the success
  req.log.info(
    {
      event: 'userSignedUp',
      userId: user._id.toString()
    },
    'User signup completed'
  );

  // 3) send the verification email
  await createSendVerificationEmail(req, user);

  // 4) send the response
  res.status(201).json({
    status: 'success',
    message: 'Account created. Please check your email to get verified before login'
  });
};

// ─── GET api/v1/auth/verify-email/:token ──────────────────────────────────────────

export const verifyEmail = async (req, res) => {
  // 1) Quick syntax check before hashing
  const { token } = req.validatedData.params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalidVerificationTokenError();

  // 2) hash the incoming raw token
  const hashedToken = createHash('sha256')
    .update(req.validatedData.params.token)
    .digest('hex');

  // 3) find user associated with the token
  const user = await User.findOneAndUpdate(
    {
      emailVerifiedAt: null,
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpiresAt: { $gt: Date.now() },
    },
    {
      // 4) mark the email as verified and do token cleanup
      $set: { emailVerifiedAt: new Date() },
      $unset: {
        emailVerificationToken: '',
        emailVerificationTokenExpiresAt: '',
      }
    },
    {
      // return updated doc (default return the original)
      new: true,
    }
  );
  
  if (!user) throw invalidVerificationTokenError();
  
  // 5) log the success
  req.log.info(
    {
      event: 'userEmailVerified',
      userId: user._id.toString()
    },
    'User email verified'
  );

  // 6) return the response
  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully'
  });
};