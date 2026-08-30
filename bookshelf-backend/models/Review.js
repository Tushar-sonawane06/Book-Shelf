import mongoose from 'mongoose';

/**
 * Review schema for the BookShelf reviews & ratings system.
 *
 * Each review links a user to a book and records their rating (1-5 stars)
 * and optional text. A unique compound index on (userId, bookId) ensures
 * a user can only review a book once — duplicate reviews are rejected at
 * the database level rather than relying on a race-prone application check.
 *
 * The `verifiedPurchase` flag is set when the reviewer has a delivered order
 * containing this book. It lets the UI surface a badge without a separate
 * query against the orders collection on every render.
 */
const reviewSchema = new mongoose.Schema(
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
      maxlength: 2000,
      default: '',
    },
    /**
     * Set to true when the reviewer has a delivered order containing
     * this book. Computed at creation time and never changed — if the
     * order is later returned the badge is arguably still valid.
     */
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    /**
     * Soft-delete flag. The review stays in the database (and still
     * affects the average rating) until the user or an admin removes it.
     */
    hidden: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// One review per user per book.
reviewSchema.index({ userId: 1, bookId: 1 }, { unique: true });

// The main read path: all visible reviews for a book, newest first.
reviewSchema.index({ bookId: 1, hidden: 1, createdAt: -1 });

// Helpful-count queries (top reviews).
reviewSchema.index({ bookId: 1, hidden: 1, helpfulCount: -1 });

const Review = mongoose.model('Review', reviewSchema);

export default Review;
