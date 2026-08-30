import ReadingList, { SHELVES } from '../models/ReadingList.js';

// ── Helpers ────────────────────────────────────────────────────────────────

async function shelfStats(userId) {
  const counts = await ReadingList.aggregate([
    { $match: { userId } },
    { $group: { _id: '$shelf', count: { $sum: 1 } } },
  ]);

  const stats = {};
  for (const shelf of SHELVES) {
    stats[shelf] = 0;
  }
  for (const { _id, count } of counts) {
    stats[_id] = count;
  }
  stats.total = Object.values(stats).reduce((a, b) => a + b, 0);
  return stats;
}

function formatEntry(entry) {
  const obj = entry.toObject ? entry.toObject() : entry;
  return {
    id: obj._id.toString(),
    bookId: obj.bookId,
    userId: obj.userId?.toString?.() || obj.userId,
    shelf: obj.shelf,
    notes: obj.notes,
    rating: obj.rating,
    progress: obj.progress,
    startedAt: obj.startedAt,
    finishedAt: obj.finishedAt,
    sortOrder: obj.sortOrder,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

// ── Add or move a book to a shelf ──────────────────────────────────────────

/**
 * @desc    Add a book to the reading list (or move it if already present)
 * @route   POST /api/reading-list
 * @access  Authenticated
 */
export const addBook = async (req, res, next) => {
  try {
    const { bookId, shelf = 'want-to-read', notes, rating } = req.body;
    const userId = req.user._id;

    // Check if already on the list
    let entry = await ReadingList.findOne({ userId, bookId });

    if (entry) {
      // Move to new shelf
      const previousShelf = entry.shelf;
      entry.shelf = shelf;

      // Auto-set timestamps on shelf transitions
      if (shelf === 'currently-reading' && previousShelf !== 'currently-reading') {
        entry.startedAt = new Date();
        entry.progress = entry.progress ?? 0;
      }
      if (shelf === 'finished' && previousShelf !== 'finished') {
        entry.finishedAt = new Date();
        entry.progress = 100;
      }
      if (shelf === 'want-to-read') {
        entry.progress = null;
        entry.startedAt = null;
        entry.finishedAt = null;
      }

      if (notes !== undefined) entry.notes = notes;
      if (rating !== undefined) entry.rating = rating;

      await entry.save();

      const stats = await shelfStats(userId);
      return res.json({
        message: `Moved to "${shelf}"`,
        entry: formatEntry(entry),
        stats,
      });
    }

    // New entry
    const newEntry = {
      userId,
      bookId,
      shelf,
      notes: notes || '',
      rating: rating || null,
    };

    if (shelf === 'currently-reading') {
      newEntry.startedAt = new Date();
      newEntry.progress = 0;
    }
    if (shelf === 'finished') {
      newEntry.finishedAt = new Date();
      newEntry.progress = 100;
    }

    entry = await ReadingList.create(newEntry);

    const stats = await shelfStats(userId);
    res.status(201).json({
      message: `Added to "${shelf}"`,
      entry: formatEntry(entry),
      stats,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get all entries for the current user ───────────────────────────────────

/**
 * @desc    Get the current user's reading list, optionally filtered by shelf
 * @route   GET /api/reading-list
 * @access  Authenticated
 */
export const getMyList = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { shelf } = req.query;

    const filter = { userId };
    if (shelf && SHELVES.includes(shelf)) {
      filter.shelf = shelf;
    }

    const entries = await ReadingList.find(filter)
      .sort({ shelf: 1, sortOrder: 1, createdAt: -1 })
      .lean();

    const stats = await shelfStats(userId);

    res.json({
      entries: entries.map((e) => ({ ...e, id: e._id.toString() })),
      stats,
    });
  } catch (error) {
    next(error);
  }
};

// ── Check if a book is on the reading list ─────────────────────────────────

/**
 * @desc    Check if a specific book is on the user's reading list
 * @route   GET /api/reading-list/check/:bookId
 * @access  Authenticated
 */
export const checkBook = async (req, res, next) => {
  try {
    const entry = await ReadingList.findOne({
      userId: req.user._id,
      bookId: req.params.bookId,
    }).lean();

    if (!entry) {
      return res.json({ onList: false, entry: null });
    }

    res.json({ onList: true, entry: formatEntry(entry) });
  } catch (error) {
    next(error);
  }
};

// ── Update an entry ────────────────────────────────────────────────────────

/**
 * @desc    Update notes, rating, progress, or shelf of an entry
 * @route   PUT /api/reading-list/:entryId
 * @access  Authenticated (owner only)
 */
export const updateEntry = async (req, res, next) => {
  try {
    const entry = await ReadingList.findById(req.params.entryId);

    if (!entry) {
      return res.status(404).json({ message: 'Reading list entry not found' });
    }

    if (entry.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your reading list' });
    }

    const { shelf, notes, rating, progress } = req.body;
    const previousShelf = entry.shelf;

    if (shelf !== undefined && shelf !== entry.shelf) {
      entry.shelf = shelf;

      if (shelf === 'currently-reading' && previousShelf !== 'currently-reading') {
        entry.startedAt = entry.startedAt || new Date();
        if (entry.progress === null || entry.progress === undefined) {
          entry.progress = 0;
        }
      }
      if (shelf === 'finished' && previousShelf !== 'finished') {
        entry.finishedAt = new Date();
        entry.progress = 100;
      }
      if (shelf === 'want-to-read') {
        entry.progress = null;
      }
    }

    if (notes !== undefined) entry.notes = notes;
    if (rating !== undefined) entry.rating = rating;
    if (progress !== undefined && entry.shelf === 'currently-reading') {
      entry.progress = Math.min(100, Math.max(0, progress));
    }

    await entry.save();

    const stats = await shelfStats(req.user._id);
    res.json({
      message: 'Entry updated',
      entry: formatEntry(entry),
      stats,
    });
  } catch (error) {
    next(error);
  }
};

// ── Remove a book from the reading list ────────────────────────────────────

/**
 * @desc    Remove a book from the reading list
 * @route   DELETE /api/reading-list/:entryId
 * @access  Authenticated (owner only)
 */
export const removeBook = async (req, res, next) => {
  try {
    const entry = await ReadingList.findById(req.params.entryId);

    if (!entry) {
      return res.status(404).json({ message: 'Reading list entry not found' });
    }

    if (entry.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your reading list' });
    }

    await ReadingList.findByIdAndDelete(req.params.entryId);

    const stats = await shelfStats(req.user._id);
    res.json({ message: 'Removed from reading list', stats });
  } catch (error) {
    next(error);
  }
};

// ── Remove by bookId (convenience for toggling) ───────────────────────────

/**
 * @desc    Remove a book by its bookId (useful for toggle patterns on the frontend)
 * @route   DELETE /api/reading-list/book/:bookId
 * @access  Authenticated
 */
export const removeByBookId = async (req, res, next) => {
  try {
    const result = await ReadingList.findOneAndDelete({
      userId: req.user._id,
      bookId: req.params.bookId,
    });

    if (!result) {
      return res.status(404).json({ message: 'Book not on reading list' });
    }

    const stats = await shelfStats(req.user._id);
    res.json({ message: 'Removed from reading list', stats });
  } catch (error) {
    next(error);
  }
};

// ── Reorder within a shelf ────────────────────────────────────────────────

/**
 * @desc    Reorder entries within a shelf
 * @route   PUT /api/reading-list/reorder
 * @access  Authenticated
 */
export const reorderEntries = async (req, res, next) => {
  try {
    const { shelf, orderedIds } = req.body;

    if (!shelf || !Array.isArray(orderedIds)) {
      return res.status(400).json({ message: 'shelf and orderedIds array are required' });
    }

    const updates = orderedIds.map((id, index) =>
      ReadingList.findOneAndUpdate(
        { _id: id, userId: req.user._id, shelf },
        { sortOrder: index },
        { new: true }
      )
    );

    await Promise.all(updates);

    const entries = await ReadingList.find({ userId: req.user._id, shelf })
      .sort({ sortOrder: 1 })
      .lean();

    res.json({
      message: 'Reordered',
      entries: entries.map((e) => ({ ...e, id: e._id.toString() })),
    });
  } catch (error) {
    next(error);
  }
};

// ── Get reading stats (summary) ───────────────────────────────────────────

/**
 * @desc    Get reading statistics for the current user
 * @route   GET /api/reading-list/stats
 * @access  Authenticated
 */
export const getStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const stats = await shelfStats(userId);

    // Average rating for finished books
    const avgResult = await ReadingList.aggregate([
      { $match: { userId, shelf: 'finished', rating: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    stats.averageRating = avgResult.length > 0
      ? Math.round(avgResult[0].avg * 10) / 10
      : null;
    stats.ratedCount = avgResult.length > 0 ? avgResult[0].count : 0;

    // Currently reading progress
    const currentBooks = await ReadingList.find({
      userId,
      shelf: 'currently-reading',
      progress: { $ne: null },
    })
      .select('bookId progress')
      .lean();

    stats.currentlyReading = currentBooks.map((b) => ({
      bookId: b.bookId,
      progress: b.progress,
    }));

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export default {
  addBook,
  getMyList,
  checkBook,
  updateEntry,
  removeBook,
  removeByBookId,
  reorderEntries,
  getStats,
};
