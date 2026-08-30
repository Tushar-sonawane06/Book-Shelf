import ReadingGoal from '../models/ReadingGoal.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function ensureMonth(goal, month) {
  let entry = goal.months.find((m) => m.month === month);
  if (!entry) {
    entry = { month, booksRead: 0 };
    goal.months.push(entry);
  }
  return entry;
}

function computeStats(goal) {
  const totalRead = goal.months.reduce((sum, m) => sum + m.booksRead, 0);
  const percentage =
    goal.yearlyGoal > 0
      ? Math.min(100, Math.round((totalRead / goal.yearlyGoal) * 100))
      : 0;
  const remaining = Math.max(0, goal.yearlyGoal - totalRead);

  // Estimate pace: how many books per month to finish on time
  const currentMonth = new Date().getMonth() + 1;
  const monthsLeft = Math.max(1, 12 - currentMonth + 1);
  const paceNeeded = remaining > 0 ? Math.ceil(remaining / monthsLeft) : 0;

  return {
    yearlyGoal: goal.yearlyGoal,
    totalRead,
    percentage,
    remaining,
    paceNeeded,
    monthsLeft,
    onTrack: totalRead >= (goal.yearlyGoal * currentMonth) / 12,
  };
}

function formatGoal(goal) {
  const obj = goal.toObject ? goal.toObject() : goal;
  const stats = computeStats(obj);
  return {
    id: obj._id.toString(),
    year: obj.year,
    yearlyGoal: obj.yearlyGoal,
    months: obj.months
      .slice()
      .sort((a, b) => a.month - b.month)
      .map((m) => ({ month: m.month, booksRead: m.booksRead })),
    stats,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

// ── Get or create the current year's goal ──────────────────────────────────

/**
 * @desc    Get the user's reading goal for a year (defaults to current)
 * @route   GET /api/reading-goals?year=2026
 * @access  Authenticated
 */
export const getGoal = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    let goal = await ReadingGoal.findOne({ userId: req.user._id, year });

    // Auto-create with default 12 books if none exists
    if (!goal) {
      goal = await ReadingGoal.create({
        userId: req.user._id,
        year,
        yearlyGoal: 12,
        months: [],
      });
    }

    res.json(formatGoal(goal));
  } catch (error) {
    next(error);
  }
};

// ── Set the yearly goal ────────────────────────────────────────────────────

/**
 * @desc    Set or update the yearly reading goal
 * @route   PUT /api/reading-goals
 * @access  Authenticated
 */
export const setGoal = async (req, res, next) => {
  try {
    const { yearlyGoal } = req.body;
    const year = parseInt(req.body.year, 10) || new Date().getFullYear();

    let goal = await ReadingGoal.findOne({ userId: req.user._id, year });

    if (goal) {
      goal.yearlyGoal = yearlyGoal;
      await goal.save();
    } else {
      goal = await ReadingGoal.create({
        userId: req.user._id,
        year,
        yearlyGoal,
        months: [],
      });
    }

    res.json({
      message: 'Reading goal updated',
      goal: formatGoal(goal),
    });
  } catch (error) {
    next(error);
  }
};

// ── Record a book completion ───────────────────────────────────────────────

/**
 * @desc    Record that a book was finished in a given month
 * @route   POST /api/reading-goals/complete
 * @access  Authenticated
 *
 * Increments the monthly count. Idempotent for the same month — calling
 * this twice for the same month adds 1 each time, which is correct: it
 * means "finished two books this month".
 */
export const recordCompletion = async (req, res, next) => {
  try {
    const { month, year } = req.body;
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    let goal = await ReadingGoal.findOne({ userId: req.user._id, year: targetYear });

    if (!goal) {
      goal = await ReadingGoal.create({
        userId: req.user._id,
        year: targetYear,
        yearlyGoal: 12,
        months: [],
      });
    }

    const entry = ensureMonth(goal, targetMonth);
    entry.booksRead += 1;
    await goal.save();

    res.json({
      message: 'Book completion recorded',
      goal: formatGoal(goal),
    });
  } catch (error) {
    next(error);
  }
};

// ── Undo a book completion ─────────────────────────────────────────────────

/**
 * @desc    Undo a book completion for a given month
 * @route   POST /api/reading-goals/uncomplete
 * @access  Authenticated
 */
export const undoCompletion = async (req, res, next) => {
  try {
    const { month, year } = req.body;
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const goal = await ReadingGoal.findOne({ userId: req.user._id, year: targetYear });

    if (!goal) {
      return res.status(404).json({ message: 'No reading goal found for this year' });
    }

    const entry = goal.months.find((m) => m.month === targetMonth);
    if (!entry || entry.booksRead <= 0) {
      return res.status(400).json({ message: 'No completions to undo for this month' });
    }

    entry.booksRead -= 1;
    await goal.save();

    res.json({
      message: 'Completion undone',
      goal: formatGoal(goal),
    });
  } catch (error) {
    next(error);
  }
};

// ── Get stats across multiple years ────────────────────────────────────────

/**
 * @desc    Get reading goal stats for multiple years
 * @route   GET /api/reading-goals/history?years=3
 * @access  Authenticated
 */
export const getHistory = async (req, res, next) => {
  try {
    const count = Math.min(10, parseInt(req.query.years, 10) || 3);
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - count + 1;

    const goals = await ReadingGoal.find({
      userId: req.user._id,
      year: { $gte: startYear, $lte: currentYear },
    }).sort({ year: 1 }).lean();

    res.json(
      goals.map((g) => ({
        year: g.year,
        yearlyGoal: g.yearlyGoal,
        totalRead: g.months.reduce((sum, m) => sum + m.booksRead, 0),
        percentage:
          g.yearlyGoal > 0
            ? Math.min(100, Math.round((g.months.reduce((s, m) => s + m.booksRead, 0) / g.yearlyGoal) * 100))
            : 0,
        months: g.months.map((m) => ({ month: m.month, booksRead: m.booksRead })),
      }))
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getGoal,
  setGoal,
  recordCompletion,
  undoCompletion,
  getHistory,
};
