import mongoose from 'mongoose';
import Session from '../models/Session.js';

// In-memory fallback set for environments running without active Mongo connection (e.g. lightweight node unit tests)
const revokedTokensMemory = new Set();

const isMongoConnected = () => mongoose.connection.readyState === 1;

class SessionRepository {
  async createSession(userId, token, expiresAt) {
    if (isMongoConnected()) {
      try {
        await Session.create({ userId, token, expiresAt, revoked: false });
      } catch (err) {
        console.error('[sessionRepository] Error creating session in MongoDB:', err.message);
      }
    }
  }

  async isRevoked(token) {
    if (!token) return true;
    if (revokedTokensMemory.has(token)) return true;

    if (isMongoConnected()) {
      try {
        const session = await Session.findOne({ token }).lean();
        if (session && session.revoked) {
          return true;
        }
      } catch (err) {
        console.error('[sessionRepository] Error checking session revocation in Mongo:', err.message);
      }
    }
    return false;
  }

  async revokeSession(token) {
    if (!token) return;
    revokedTokensMemory.add(token);

    if (isMongoConnected()) {
      try {
        await Session.findOneAndUpdate(
          { token },
          { $set: { revoked: true } },
          { new: true }
        );
      } catch (err) {
        console.error('[sessionRepository] Error revoking session in MongoDB:', err.message);
      }
    }
  }

  async revokeAllUserSessions(userId) {
    if (isMongoConnected()) {
      try {
        await Session.updateMany({ userId }, { $set: { revoked: true } });
      } catch (err) {
        console.error('[sessionRepository] Error revoking all user sessions in Mongo:', err.message);
      }
    }
  }

  clearMemoryCache() {
    revokedTokensMemory.clear();
  }
}

export default new SessionRepository();
