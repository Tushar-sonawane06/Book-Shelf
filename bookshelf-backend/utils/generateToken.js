import jwt from 'jsonwebtoken';
import { getJwtConfig } from '../config/jwt.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './cookies.js';
import sessionRepository from '../repositories/sessionRepository.js';

/**
 * Sign a session token, track it in session store, and attach it as an httpOnly cookie.
 */
const generateToken = (res, userId, email, role) => {
  const { secret, expiresIn, maxAgeMs } = getJwtConfig();

  const token = jwt.sign({ userId, email, role }, secret, { expiresIn });

  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions({ maxAgeMs }));

  const expiresAt = new Date(Date.now() + maxAgeMs);
  sessionRepository.createSession(userId, token, expiresAt).catch((err) =>
    console.error('[generateToken] Error saving session:', err.message)
  );

  return token;
};

export default generateToken;
