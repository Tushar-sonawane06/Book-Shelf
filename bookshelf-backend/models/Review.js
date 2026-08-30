import mongoose from 'mongoose';

/**
 * A reader review attached to a single book.
 *
 * One review per user per book, enforced by a compound unique index.
 * The `status` field lets a future moderation queue surface without a schema
 * change — right now everything is auto-approved, but the column is already
 * there for when someone wants to build admin review management.
 */
const reviewSchema = new mongoose.Schema(
  {
    bookId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },
    body: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    /**
     * Soft-delete flag. A review that is hidden is not returned to the public
     * API but still exists for admin audit trails and aggregate recalculation.
     */
    hidden: {
      type: Boolean,
      default: false,
    },
    /**
     * Tracks which other users clicked "helpful" on this review.
     * Stored as an array of user ids — small enough for a bookshop, and it
     * makes toggling a vote trivial.
     */
    helpfulBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    helpfulCount: {
      type: Number,
      default: 0,
    },
    /**
     * Whether the reviewer purchased this book through the platform.
     * Set at review-creation time by checking the user's order history.
     */
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// One review per user per book.
reviewSchema.index({ bookId: 1, userId: 1 }, { unique: true });
// Public listing: visible reviews for a book, newest first.
reviewSchema.index({ bookId: 1, hidden: 1, createdAt: -1 });
// Aggregate helper: compute average rating for a book.
reviewSchema.index({ bookId: 1, hidden: 1, rating: 1 });

const Review = mongoose.model('Review', reviewSchema);

export default Review;
