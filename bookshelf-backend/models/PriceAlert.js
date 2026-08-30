import mongoose from 'mongoose';

/**
 * A price drop alert.
 *
 * Users set a target price for a book. When the current price falls to or
 * below that target the alert fires — right now that means marking it as
 * notified so the frontend can show it; a real deployment would send an
 * email or push notification here.
 *
 * One active alert per user per book. An expired or notified alert is soft-
 * deleted (`active: false`) rather than removed, so the user can see their
 * alert history.
 */
const priceAlertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookId: {
      type: String,
      required: true,
      trim: true,
    },
    /**
     * The price the user wants to be notified at.
     */
    targetPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    /**
     * The price of the book when the alert was created or last checked.
     * Stored so the frontend can show "was ₹399 → now ₹299" without
     * an extra round trip.
     */
    currentPriceAtCreation: {
      type: Number,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    notified: {
      type: Boolean,
      default: false,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One active alert per user per book.
priceAlertSchema.index({ userId: 1, bookId: 1, active: 1 });
// Efficient lookup for the sweeper: all active alerts.
priceAlertSchema.index({ active: 1 });
// User's alerts listing.
priceAlertSchema.index({ userId: 1, createdAt: -1 });

const PriceAlert = mongoose.model('PriceAlert', priceAlertSchema);

export default PriceAlert;
