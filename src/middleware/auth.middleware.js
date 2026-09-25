import jwt from 'jsonwebtoken';
import ApiError from '../errors/api-error.js';
import User from '../models/user.js';
import config from '../config/env.js';

// Middleware Job: checking user is correctly authenticated.

const invalidAccessTokenError = () => new ApiError(
  'Access token is invalid or expired',
  401,
  { code: 'INVALID_ACCESS_TOKEN' }
);

const authenticate = ({ optional }) => async (req, _res, next) => {
  // 1) catch token
  const authHeader = req?.headers?.authorization;

  if (authHeader === undefined) {
    if (optional) {
      return next();
    }

    throw new ApiError(
      'Authentication required. Please login to continue.',
      401,
      {code: "AUTHENTICATION_REQUIRED" }
    );
  }

  const token = /^Bearer ([^\s]+)$/.exec(authHeader)?.[1];
  
  // 2) verify token
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.accessTokenSecret, { algorithms: ['HS256'] });
  } catch {
    throw invalidAccessTokenError();
  }

  // 3) check user exists
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw invalidAccessTokenError();
  
  // 4) check password changed after token was issued
  if (user.passwordChangedAt && user.passwordChangedAt.getTime() > payload.iat * 1000) {
    throw new ApiError(
      'Your password has changed. Please log in again.',
      401,
      { code: 'PASSWORD_CHANGED' }
    );
  } 

  // 5) save user in req
  req.user = { id: user._id }

  // 6) continue to next middleware
  return next();
};

export default authenticate;