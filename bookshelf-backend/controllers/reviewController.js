import Review from '../models/Review.js';
import Order from '../models/Order.js';
import bookRepository from '../repositories/bookRepository.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check whether the reviewer has a delivered order containing the book.
 *
 * This is a write-time check: the flag is stored on the review rather than
 * re-queried on every read. The consequence is that a badge can only appear
 * or disappear when the review is created or edited, not when an order is
 * delivered after the fact — which is the right trade-off for a feature that
 * is purely cosmetic.
 */
async function hasVerifiedPurchase(userId, bookId) {
  return Order.exists({
    userId,
    status: 'delivered',
    'items.bookId': bookId,
  });
}

/**
 * After every create or update that changed a rating, recalculate the
 * aggregate and push it into the book catalogue.
 *
 * The books are stored in a JSON file, so there is no aggregation pipeline
 * to rely on.  The query here is deliberately narrow (visible reviews only)
 * and the write goes through the repository so the cache is invalidated.
 */
async function refreshBookRating(bookId) {
  const stats = await Review.aggregate([
    { $match: { bookId, hidden: false } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const average = stats.length > 0 ? Math.round(stats[0].average * 10) / 10 : 0;
  const count = stats.length > 0 ? stats[0].count : 0;

  bookRepository.updateBook(bookId, {
    rating: average,
    reviewsCount: count,
  });
}

// ── Controllers ────────────────────────────────────────────────────────────

/**
 * @desc    Get all reviews for a book
 * @route   GET /api/reviews/:bookId
 * @access  Public
 */
export const getBookReviews = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const sort = req.query.sort === 'helpful' ? { helpfulCount: -1 } : { createdAt: -1 };

    const [reviews, total] = await Promise.all([
      Review.find({ bookId, hidden: false })
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments({ bookId, hidden: false }),
    ]);

    // Map _id → id for a consistent JSON shape.
    const mapped = reviews.map((r) => ({ ...r, id: r._id.toString() }));

    res.status(200).json({
      reviews: mapped,
      page,
      limit,
      totalReviews: total,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get rating breakdown (1-5 star counts) for a book
 * @route   GET /api/reviews/:bookId/breakdown
 * @access  Public
 */
export const getReviewBreakdown = async (req, res, next) => {
  try {
    const { bookId } = req.params;

    const stats = await Review.aggregate([
      { $match: { bookId, hidden: false } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    // Build a complete 5→1 map even if some stars have zero reviews.
    const breakdown = [5, 4, 3, 2, 1].map((star) => {
      const bucket = stats.find((s) => s._id === star);
      return { star, count: bucket ? bucket.count : 0 };
    });

    const totalReviews = breakdown.reduce((sum, b) => sum + b.count, 0);
    const averageRating =
      totalReviews > 0
        ? Math.round(
            (breakdown.reduce((sum, b) => sum + b.star * b.count, 0) / totalReviews) * 10
          ) / 10
        : 0;

    res.status(200).json({
      bookId,
      averageRating,
      totalReviews,
      breakdown,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a review
 * @route   POST /api/reviews
 * @access  Private (requires login)
 */
export const createReview = async (req, res, next) => {
  try {
    const { bookId, rating, title, body } = req.body;
    const userId = req.user._id;

    // Ensure the book exists.
    const book = bookRepository.getBookById(bookId);
    if (!book) {
      return res.status(404).json({ message: `Book not found: ${bookId}` });
    }

    // One review per user per book — the unique index catches the race, but
    // a friendlier error message here avoids a raw MongoDB duplicate-key 500.
    const existing = await Review.findOne({ userId, bookId });
    if (existing) {
      return res.status(409).json({
        message: 'You have already reviewed this book. You can edit your existing review.',
        reviewId: existing._id.toString(),
      });
    }

    const verifiedPurchase = await hasVerifiedPurchase(userId, bookId);

    const review = await Review.create({
      userId,
      bookId,
      rating: Math.round(Number(rating)),
      title: title || '',
      body: body || '',
      verifiedPurchase,
    });

    // Push the new average into the book catalogue.
    await refreshBookRating(bookId);

    res.status(201).json({
      message: 'Review created successfully',
      review: { ...review.toObject(), id: review._id.toString() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a review (owner or admin)
 * @route   PUT /api/reviews/:reviewId
 * @access  Private (owner or admin)
 */
export const updateReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, body } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const isOwner = review.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to edit this review' });
    }

    if (rating !== undefined) review.rating = Math.round(Number(rating));
    if (title !== undefined) review.title = title;
    if (body !== undefined) review.body = body;

    const saved = await review.save();

    await refreshBookRating(review.bookId);

    res.status(200).json({
      message: 'Review updated successfully',
      review: { ...saved.toObject(), id: saved._id.toString() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a review (owner or admin) — soft-deletes by setting hidden
 * @route   DELETE /api/reviews/:reviewId
 * @access  Private (owner or admin)
 */
export const deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const isOwner = review.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    review.hidden = true;
    await review.save();

    await refreshBookRating(review.bookId);

    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark a review as helpful
 * @route   POST /api/reviews/:reviewId/helpful
 * @access  Private
 */
export const markHelpful = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Users should not mark their own review as helpful.
    if (review.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot mark your own review as helpful' });
    }

    review.helpfulCount = (review.helpfulCount || 0) + 1;
    await review.save();

    res.status(200).json({
      message: 'Review marked as helpful',
      helpfulCount: review.helpfulCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get the current user's review for a specific book
 * @route   GET /api/reviews/:bookId/mine
 * @access  Private
 */
export const getMyReview = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const review = await Review.findOne({ userId: req.user._id, bookId }).lean();

    if (!review) {
      return res.status(404).json({ message: 'You have not reviewed this book yet' });
    }

    res.status(200).json({ review: { ...review, id: review._id.toString() } });
  } catch (error) {
    next(error);
  }
};
