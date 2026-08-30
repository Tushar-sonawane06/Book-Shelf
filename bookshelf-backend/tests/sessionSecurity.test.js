import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import sessionRepository from '../repositories/sessionRepository.js';
import { protect } from '../middleware/authMiddleware.js';
import { logoutUser } from '../controllers/authController.js';
import { adminMutationLimiter } from '../middleware/rateLimiter.js';
import User from '../models/User.js';
import { SESSION_COOKIE_NAME } from '../utils/cookies.js';

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    cookies: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, value, options) {
      this.cookies[name] = { value, options };
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
  };
}

describe('Session Security & Token Revocation', () => {
  beforeEach(() => {
    sessionRepository.clearMemoryCache();
    if (adminMutationLimiter.reset) adminMutationLimiter.reset();
  });

  test('sessionRepository correctly identifies revoked token', async () => {
    const testToken = 'token_test_123';

    assert.equal(await sessionRepository.isRevoked(testToken), false);

    await sessionRepository.revokeSession(testToken);

    assert.equal(await sessionRepository.isRevoked(testToken), true);
  });

  test('protect middleware rejects revoked token', async () => {
    const token = 'revoked_token_sample';
    await sessionRepository.revokeSession(token);

    const req = { cookies: { [SESSION_COOKIE_NAME]: token } };
    const res = makeRes();
    let nextError = null;

    await protect(req, res, (err) => {
      nextError = err;
    });

    assert.equal(res.statusCode, 401);
    assert.match(nextError.message, /Session has been revoked/);
  });

  test('logoutUser revokes token in sessionRepository', async () => {
    const token = 'active_user_token_777';

    const req = { cookies: { [SESSION_COOKIE_NAME]: token } };
    const res = makeRes();

    await logoutUser(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.cookies[SESSION_COOKIE_NAME].value, '');
    assert.equal(await sessionRepository.isRevoked(token), true);
  });

  test('adminMutationLimiter sets rate limit headers and blocks excess requests', () => {
    const req = { ip: '192.168.1.100' };

    for (let i = 0; i < 60; i++) {
      const res = makeRes();
      let calledNext = false;
      adminMutationLimiter(req, res, () => {
        calledNext = true;
      });
      assert.ok(calledNext);
    }

    // 61st request should hit 429 rate limit
    const resOverLimit = makeRes();
    let calledNext = false;
    adminMutationLimiter(req, resOverLimit, () => {
      calledNext = true;
    });

    assert.equal(calledNext, false);
    assert.equal(resOverLimit.statusCode, 429);
    assert.match(resOverLimit.body.message, /Too many administrative request attempts/);
  });
});
