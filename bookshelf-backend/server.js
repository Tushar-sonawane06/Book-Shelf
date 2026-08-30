import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import app from './app.js';
import { assertJwtConfig, ConfigError } from './config/jwt.js';
import { startReservationSweeper } from './services/reservationSweeper.js';
import { DEFAULT_RESERVATION_TTL_MS } from './utils/reservations.js';

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookshelf';

/**
 * How long an unpaid checkout may hold inventory, and how often to look.
 *
 * Both are read from the environment so the numbers can be tuned without a
 * deploy of new code; the defaults are sensible for a small shop.
 */
const RESERVATION_TTL_MS = Number(process.env.RESERVATION_TTL_MS) || DEFAULT_RESERVATION_TTL_MS;
const RESERVATION_SWEEP_INTERVAL_MS =
  Number(process.env.RESERVATION_SWEEP_INTERVAL_MS) || 5 * 60 * 1000;

/**
 * Validate configuration before anything else happens.
 *
 * This runs before the Mongo connection on purpose. A bad JWT_SECRET is not
 * something to discover on the first login of the day — at that point the
 * process is already accepting traffic, and in the specific case of a missing
 * secret it would have been accepting traffic while signing sessions anyone
 * could forge. Refusing to start is the only safe answer, and the message has
 * to say what to do about it.
 */
try {
  assertJwtConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`Configuration error: ${error.message}`);
    process.exit(1);
  }
  throw error;
}

import bookRepository from './repositories/bookRepository.js';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await bookRepository.syncDatabaseWithJson();

    /*
     * Checkout takes inventory before the payment intent exists, and nothing
     * put it back when the customer never came back — no expiry, no sweeper,
     * and a webhook that marks an order failed without restoring its lines.
     * Stock leaked away permanently, one abandoned tab and one declined card
     * at a time. See #329.
     *
     * Started after the Mongo connection, because its first pass queries
     * immediately: a process that crashed mid-checkout left stock reserved
     * against an order nobody will ever pay for, and waiting a full interval
     * to notice is a whole interval of a shop being wrong.
     */
    startReservationSweeper({
      ttlMs: RESERVATION_TTL_MS,
      intervalMs: RESERVATION_SWEEP_INTERVAL_MS,
    });

    console.log(
      `Reservation sweeper running every ${Math.round(RESERVATION_SWEEP_INTERVAL_MS / 1000)}s ` +
        `(holds expire after ${Math.round(RESERVATION_TTL_MS / 60000)}m)`
    );

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  });
