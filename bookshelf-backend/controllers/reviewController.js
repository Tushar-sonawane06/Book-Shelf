import Review from '../models/Review.js';
import Order from '../models/Order.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute aggregate stats for a book's reviews and return them alongside
 * a page of review documents.
 */
async function aggregateBookStats(bookId) {
  const [stats] = await Review.aggregate([
    { $match: { bookId, hidden: false } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        breakdown: {
          $push: '$rating',
        },
      },
    },
  ]);

  if (!stats) {
    return {
      averageRating: 0,
      totalReviews: 0,
      breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const rating of stats.breakdown) {
    breakdown[rating] = (breakdown[rating] || 0) + 1;
  }

  return {
    averageRating: Math.round(stats.averageRating * 10) / 10,
    totalReviews: stats.totalReviews,
    breakdown,
  };
}

/**
 * Check whether the user has a delivered order containing this book.
 * Used to set the verified-purchase badge on new reviews.
 */
async function hasDeliveredOrder(userId, bookId) {
  const order = await Order.findOne({
    userId,
    'items.bookId': bookId,
    status: 'delivered',
  }).lean();

  return !!order;
}

// ── Create a review ────────────────────────────────────────────────────────

/**
 * @desc    Create a review for a book
 * @route   POST /api/reviews
 * @access  Authenticated
 */
export const createReview = async (req, res, next) => {
  try {
    const { bookId, rating, title, body } = req.body;

    // One review per user per book.
    const existing = await Review.findOne({
      userId: req.user._id,
      bookId,
    });

    if (existing) {
      return res.status(409).json({
        message: 'You have already reviewed this book. You can edit your existing review.',
        reviewId: existing._id.toString(),
      });
    }

    const verifiedPurchase = await hasDeliveredOrder(req.user._id, bookId);

    const review = await Review.create({
      bookId,
      userId: req.user._id,
      rating,
      title: title || '',
      body: body || '',
      verifiedPurchase,
    });

    const stats = await aggregateBookStats(bookId);

    res.status(201).json({
      message: 'Review submitted successfully',
      review: formatReview(review, req.user._id),
      stats,
    });
  } catch (error) {
    next(error);
  }
};

// ── List reviews for a book ────────────────────────────────────────────────

/**
 * @desc    Get all visible reviews for a book (with pagination & sorting)
 * @route   GET /api/reviews/book/:bookId
 * @access  Public
 */
export const getBookReviews = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const sort = req.query.sort || 'newest';
    const skip = (page - 1) * limit;

    let sortSpec = { createdAt: -1 };
    if (sort === 'oldest') sortSpec = { createdAt: 1 };
    else if (sort === 'highest') sortSpec = { rating: -1, createdAt: -1 };
    else if (sort === 'lowest') sortSpec = { rating: 1, createdAt: -1 };
    else if (sort === 'helpful') sortSpec = { helpfulCount: -1, createdAt: -1 };

    const [reviews, total] = await Promise.all([
      Review.find({ bookId, hidden: false })
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name avatar')
        .lean(),
      Review.countDocuments({ bookId, hidden: false }),
    ]);

    const stats = await aggregateBookStats(bookId);

    res.json({
      reviews: reviews.map((r) => ({
        ...r,
        id: r._id.toString(),
        userName: r.userId?.name || 'Anonymous',
        userAvatar: r.userId?.avatar || '📚',
      })),
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Get a single review ────────────────────────────────────────────────────

/**
 * @desc    Get a single review by id
 * @route   GET /api/reviews/:reviewId
 * @access  Public
 */
export const getReview = async (req, res, next) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewId,
      hidden: false,
    })
      .populate('userId', 'name avatar')
      .lean();

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json(formatReview(review, req.user?._id));
  } catch (error) {
    next(error);
  }
};

// ── Update own review ──────────────────────────────────────────────────────

/**
 * @desc    Update your own review
 * @route   PUT /api/reviews/:reviewId
 * @access  Authenticated (owner only)
 */
export const updateReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own review' });
    }

    const { rating, title, body } = req.body;

    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (body !== undefined) review.body = body;

    await review.save();

    const stats = await aggregateBookStats(review.bookId);

    res.json({
      message: 'Review updated successfully',
      review: formatReview(review, req.user._id),
      stats,
    });
  } catch (error) {
    next(error);
  }
};

// ── Delete own review ──────────────────────────────────────────────────────

/**
 * @desc    Delete your own review
 * @route   DELETE /api/reviews/:reviewId
 * @access  Authenticated (owner only)
 */
export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own review' });
    }

    const bookId = review.bookId;
    await Review.findByIdAndDelete(req.params.reviewId);

    const stats = await aggregateBookStats(bookId);

    res.json({
      message: 'Review deleted successfully',
      stats,
    });
  } catch (error) {
    next(error);
  }
};

// ── Toggle helpful vote ────────────────────────────────────────────────────

/**
 * @desc    Toggle the "helpful" vote on a review
 * @route   POST /api/reviews/:reviewId/helpful
 * @access  Authenticated
 */
export const toggleHelpful = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot mark your own review as helpful' });
    }

    const userId = req.user._id;
    const alreadyVoted = review.helpfulBy.some(
      (id) => id.toString() === userId.toString()
    );

    if (alreadyVoted) {
      review.helpfulBy.pull(userId);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      review.helpfulBy.addToSet(userId);
      review.helpfulCount = review.helpfulBy.length;
    }

    await review.save();

    res.json({
      helpful: !alreadyVoted,
      helpfulCount: review.helpfulCount,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get user's review for a specific book ──────────────────────────────────

/**
 * @desc    Check if the current user has reviewed a specific book
 * @route   GET /api/reviews/book/:bookId/mine
 * @access  Authenticated
 */
export const getMyReviewForBook = async (req, res, next) => {
  try {
    const review = await Review.findOne({
      userId: req.user._id,
      bookId: req.params.bookId,
    }).lean();

    if (!review) {
      return res.json({ hasReview: false, review: null });
    }

    res.json({
      hasReview: true,
      review: formatReview(review, req.user._id),
    });
  } catch (error) {
    next(error);
  }
};

// ── Admin: list all reviews (with hidden) ──────────────────────────────────

/**
 * @desc    Admin: list all reviews for a book including hidden ones
 * @route   GET /api/reviews/admin/book/:bookId
 * @access  Admin
 */
export const adminGetBookReviews = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find({ bookId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email avatar')
        .lean(),
      Review.countDocuments({ bookId }),
    ]);

    res.json({
      reviews: reviews.map((r) => ({
        ...r,
        id: r._id.toString(),
        userName: r.userId?.name || 'Anonymous',
        userEmail: r.userId?.email || '',
        userAvatar: r.userId?.avatar || '📚',
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ── Admin: hide/show a review ──────────────────────────────────────────────

/**
 * @desc    Admin: toggle hidden flag on a review
 * @route   PATCH /api/reviews/:reviewId/visibility
 * @access  Admin
 */
export const adminToggleVisibility = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.hidden = !review.hidden;
    await review.save();

    const stats = await aggregateBookStats(review.bookId);

    res.json({
      message: review.hidden ? 'Review hidden' : 'Review visible',
      hidden: review.hidden,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

// ── Utilities ──────────────────────────────────────────────────────────────

function formatReview(review, currentUserId) {
  const obj = review.toObject ? review.toObject() : review;
  return {
    id: obj._id.toString(),
    bookId: obj.bookId,
    userId: obj.userId?.toString?.() || obj.userId,
    userName: obj.userId?.name || review.userName || 'Anonymous',
    userAvatar: obj.userId?.avatar || review.userAvatar || '📚',
    rating: obj.rating,
    title: obj.title,
    body: obj.body,
    helpfulCount: obj.helpfulCount,
    verifiedPurchase: obj.verifiedPurchase,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    userHasVotedHelpful: currentUserId
      ? obj.helpfulBy?.some((id) => id.toString() === currentUserId.toString()) || false
      : false,
  };
}

export default {
  createReview,
  getBookReviews,
  getReview,
  updateReview,
  deleteReview,
  toggleHelpful,
  getMyReviewForBook,
  adminGetBookReviews,
  adminToggleVisibility,
};
