import mongoose from 'mongoose';

/**
 * A user's personal bookshelf entry.
 *
 * Each entry places one book on one shelf. The three shelves mirror the
 * familiar "Want to Read / Currently Reading / Finished" pattern.
 * A user can have at most one entry per book — moving a book between
 * shelves updates the existing document rather than creating a new one.
 *
 * `progress` is a 0-100 percentage for "Currently Reading" and is ignored
 * on other shelves. `notes` and `rating` are freeform; rating is separate
 * from the public review system so users can track private opinions.
 */
const SHELVES = ['want-to-read', 'currently-reading', 'finished'];

const readingListSchema = new mongoose.Schema(
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
    shelf: {
      type: String,
      enum: SHELVES,
      required: true,
      default: 'want-to-read',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    /**
     * Progress percentage (0–100) for books on the "currently-reading" shelf.
     * Null on other shelves.
     */
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    /**
     * When the user started reading (moved to "currently-reading").
     */
    startedAt: {
      type: Date,
      default: null,
    },
    /**
     * When the user finished reading (moved to "finished").
     */
    finishedAt: {
      type: Date,
      default: null,
    },
    /**
     * User-chosen sort order within a shelf. Lower numbers appear first.
     */
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// One entry per user per book.
readingListSchema.index({ userId: 1, bookId: 1 }, { unique: true });
// Shelf listing: all entries on a shelf, sorted by user preference.
readingListSchema.index({ userId: 1, shelf: 1, sortOrder: 1 });
// Stats helper: count per shelf for a user.
readingListSchema.index({ userId: 1, shelf: 1 });

const ReadingList = mongoose.model('ReadingList', readingListSchema);

export { SHELVES };
export default ReadingList;
