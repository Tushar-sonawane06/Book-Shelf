import mongoose from 'mongoose';

/**
 * A user's reading goal for a calendar year.
 *
 * Stores both the annual target and per-month book counts. The monthly
 * entries are created lazily — the first time a user marks a book as
 * finished in a given month, that month's slot appears. This avoids
 * pre-populating twelve entries every January.
 *
 * `booksRead` on each month is the count of books the user marked as
 * "finished" via the reading list in that calendar month.
 */
const monthlyGoalSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    booksRead: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const readingGoalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    year: {
      type: Number,
      required: true,
      min: 2020,
      max: 2100,
    },
    yearlyGoal: {
      type: Number,
      default: 12,
      min: 1,
      max: 365,
    },
    months: [monthlyGoalSchema],
  },
  {
    timestamps: true,
  }
);

// One goal document per user per year.
readingGoalSchema.index({ userId: 1, year: 1 }, { unique: true });

const ReadingGoal = mongoose.model('ReadingGoal', readingGoalSchema);

export default ReadingGoal;
