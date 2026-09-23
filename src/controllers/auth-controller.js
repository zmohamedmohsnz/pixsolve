// ─── Import Modules ───────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import { sendVerificationEmail, sendSuccessLoginNotificationEmail, sendFailedLoginNotificationEmail} from '../services/email-service.js';
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

const generateJwtToken = (id) => {
  // it receives : payload, secret key, and options.
  // it returns  :  token as a string.
  return jwt.sign(
    {},
    config.jwt.accessTokenSecret,
    {
      algorithm: 'HS256',
      subject: id.toString(),
      expiresIn: config.jwt.accessTokenLifetimeMins * 60
    }
  );
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

// ─── POST api/v1/auth/login ──────────────────────────────────────────────────────

export const login = async (req, res) => {
  // 1) fetch the user
  const { email, password } = req.validatedData.body;
  const user = await User.findOne({ email }).select('+password');

  // 2) compare password
  const isPasswordValid = await user?.comparePassword(password);

  // 3) validate user and password are correct
  if (!user || !isPasswordValid) {
    if (user && !isPasswordValid) {
      // 3.1) send email to notify user with the failed login process
      try {
        await sendFailedLoginNotificationEmail(user?.email, {
          ip: req?.ip || 'unknown',
          userAgent: req?.headers['user-agent'] || 'unknown',
          time: new Date().toUTCString()
        });
      } catch (error) {
        req.log.error(
          {
            event: 'sendEmailFailedLoginNotificationFailed',
            error: error
          },
          'Email service failed to send the failed login notification email'
        );
      }
    }

    throw new ApiError('Invalid email or password.', 401, { code: 'INVALID_CREDENTIALS' });
  }

  // 4) validate account is verified and send a new verification link
  if (!user.emailVerifiedAt) {
    await createSendVerificationEmail(req, user);
    throw new ApiError(
      'Account is not verified. A new verification link has been sent to your inbox.',
      403,
      { code: 'EMAIL_NOT_VERIFIED' }
    );
  }

  // 5) validate user is active
  if (!user.isActive) {
    throw new ApiError(
      'Account is inactive. Please contact support.',
      403,
      { code: 'ACCOUNT_INACTIVE' }
    );
  }

  // 6) reset properties on successful login
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  // 7) generate the access token
  const accessToken = generateJwtToken(user._id);

  // 8) log the success
  req.log.info(
    {
      event: 'userLoggedIn',
      userId: user._id.toString()
    },
    'User login completed'
  );

  // 9) send email to notify user with the login process
  try {
    await sendSuccessLoginNotificationEmail(user.email, {
      ip: req?.ip || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown',
      time: new Date().toUTCString()
    });
  } catch (error) {
    req.log.error(
      {
        event: 'sendEmailSuccessLoginNotificationFailed',
        error: error
      },
      'Email service failed to send the success login notification email'
    );
  }

  // 10) send the response with the token
  res
  // these headers prevent browser cashes from storing the response as it contains
  // the access token. one for modern cashes and the other for old cashes.
  .set('Cache-Control', 'no-store')
  .set('Pragma', 'no-cache')
  .status(200)
  .json({
    status: 'success',
    data: {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: config.jwt.accessTokenLifetimeMins * 60
    }
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