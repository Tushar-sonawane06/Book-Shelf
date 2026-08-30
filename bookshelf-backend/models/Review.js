import mongoose from 'mongoose';

/**
 * Review schema for the book review system.
 *
 * Each review belongs to exactly one book and one user. A user may leave
 * only one review per book — enforced by a compound unique index. Reviews
 * carry a rating (1–5), an optional title, a body, and a helpful-vote
 * counter that readers can increment.
 *
 * The `verifiedPurchase` flag is set server-side when the reviewer has
 * actually bought the book; it is not submitted by the client.
 */
const reviewSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book reference is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating must be at most 5'],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [120, 'Review title cannot exceed 120 characters'],
      default: '',
    },
    body: {
      type: String,
      trim: true,
      maxlength: [2000, 'Review body cannot exceed 2000 characters'],
      default: '',
    },
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    helpfulBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * One review per user per book. This prevents duplicate reviews and also
 * powers the upsert in the controller.
 */
reviewSchema.index({ book: 1, user: 1 }, { unique: true });

/**
 * Partial index: only count unique helpful voters. Without this, a user
 * could click "helpful" twice and inflate the count.
 */
reviewSchema.index({ book: 1, rating: 1 });

/**
 * Strip internal fields when serialising to JSON. The `helpfulBy` array
 * is member IDs — it should not leak to other users.
 */
reviewSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.helpfulBy;
    delete ret.__v;
    return ret;
  },
});

const Review = mongoose.model('Review', reviewSchema);

export default Review;
