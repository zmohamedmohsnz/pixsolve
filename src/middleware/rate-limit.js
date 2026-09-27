import { rateLimit } from 'express-rate-limit';
import config from '../config/env.js';

// Middleware Job: limits requests an IP can send within a specific period.

const rateLimiter = ({
  windowMs,
  limit,
  skip = () => config.nodeEnv === 'test'
}) => rateLimit({
  windowMs,
  limit,

  standardHeaders: 'draft-8', // enable modern headers.
  legacyHeaders: false, // disable old non-standard headers

  // the default handler method of the rate limiter middleware sends
  // this response with 429 status code which means "too many requests".
  message: {
    status: 'error',
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests. Please try again later.'
  },

  // skip the rate limiter if the `skip` holds `true`.
  skip
});

export const authRateLimiter = rateLimiter({
  windowMs: config.rateLimit.auth.windowMins * 60 * 1000,
  limit: config.rateLimit.auth.maxRequests
});