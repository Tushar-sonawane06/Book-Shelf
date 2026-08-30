import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isAdmin } from '../utils/roles.js';
import { getJwtConfig } from '../config/jwt.js';
import { SESSION_COOKIE_NAME } from '../utils/cookies.js';
import sessionRepository from '../repositories/sessionRepository.js';

/**
 * Requires a valid, unrevoked session cookie.
 */
export const protect = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    res.status(401);
    return next(new Error('Not authorized, no token'));
  }

  // Check if session has been explicitly revoked (e.g. via logout)
  const isRevoked = await sessionRepository.isRevoked(token);
  if (isRevoked) {
    res.status(401);
    return next(new Error('Session has been revoked. Please log in again.'));
  }

  try {
    const { secret } = getJwtConfig();
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(401);
      return next(new Error('Not authorized, user no longer exists'));
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401);
    next(new Error('Not authorized, token failed'));
  }
};

/**
 * Requires an admin. Must be mounted after `protect`.
 */
export const admin = (req, res, next) => {
  if (!req.user) {
    res.status(401);
    return next(new Error('Not authorized, no token'));
  }

  if (!isAdmin(req.user)) {
    res.status(403);
    return next(new Error('Not authorized as an admin'));
  }

  next();
};
