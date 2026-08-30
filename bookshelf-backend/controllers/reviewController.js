import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Order from '../models/Order.js';

/**
 * Fetch paginated reviews for a book.
 *
 * Query params:
 *   page   (default 1)
 *   limit  (default 10, max 50)
 *   sort   "newest" | "oldest" | "highest" | "lowest" | "helpful"
 */
export const getReviewsForBook = async (req, res) => {
  try {
    const { bookId } = req.params;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const sortParam = req.query.sort || 'newest';

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { rating: -1, createdAt: -1 },
      lowest: { rating: 1, createdAt: -1 },
      helpful: { helpfulCount: -1, createdAt: -1 },
    };

    const sort = sortMap[sortParam] || sortMap.newest;

    const [reviews, total] = await Promise.all([
      Review.find({ book: bookId })
        .populate('user', 'name avatar')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments({ book: bookId }),
    ]);

    res.json({
      reviews,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[ReviewController] getReviewsForBook error:', error);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
};

/**
 * Create or update a review.
 *
 * Uses upsert: if the user already reviewed this book the rating, title and
 * body are replaced. The `editedAt` timestamp is set on updates so the UI
 * can show "edited".
 *
 * Before writing, checks whether the user has a delivered order containing
 * this book to set `verifiedPurchase`.
 */
export const createOrUpdateReview = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user._id;
    const { rating, title, body } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (title && title.length > 120) {
      return res
        .status(400)
        .json({ message: 'Review title cannot exceed 120 characters' });
    }

    if (body && body.length > 2000) {
      return res
        .status(400)
        .json({ message: 'Review body cannot exceed 2000 characters' });
    }

    // Check for verified purchase.
    const hasPurchased = await Order.exists({
      user: userId,
      'lines.book': bookId,
      status: { $in: ['paid', 'shipped', 'delivered'] },
    });

    const existing = await Review.findOne({ book: bookId, user: userId });

    let review;

    if (existing) {
      existing.rating = rating;
      existing.title = title || '';
      existing.body = body || '';
      existing.verifiedPurchase = !!hasPurchased;
      existing.editedAt = new Date();
      review = await existing.save();
    } else {
      review = await Review.create({
        book: bookId,
        user: userId,
        rating,
        title: title || '',
        body: body || '',
        verifiedPurchase: !!hasPurchased,
      });
    }

    const populated = await review.populate('user', 'name avatar');

    res.status(existing ? 200 : 201).json(populated.toJSON());
  } catch (error) {
    console.error('[ReviewController] createOrUpdateReview error:', error);

    if (error.code === 11000) {
      return res.status(409).json({ message: 'You have already reviewed this book' });
    }

    res.status(500).json({ message: 'Failed to save review' });
  }
};

/**
 * Delete a review.
 *
 * Only the review's own author may delete it. Admins are not given delete
 * power here; that is a separate moderation concern.
 */
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorised to delete this review' });
    }

    await Review.findByIdAndDelete(reviewId);

    res.json({ message: 'Review deleted' });
  } catch (error) {
    console.error('[ReviewController] deleteReview error:', error);
    res.status(500).json({ message: 'Failed to delete review' });
  }
};

/**
 * Toggle the "helpful" vote.
 *
 * If the requesting user has already voted, the vote is removed;
 * otherwise it is added. The `helpfulBy` array prevents double-counting.
 *
 * Returns the new helpful count.
 */
export const toggleHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const alreadyVoted = review.helpfulBy.some(
      (id) => id.toString() === userId.toString()
    );

    if (alreadyVoted) {
      review.helpfulBy.pull(userId);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      review.helpfulBy.addToSet(userId);
      review.helpfulCount += 1;
    }

    await review.save();

    res.json({
      helpfulCount: review.helpfulCount,
      voted: !alreadyVoted,
    });
  } catch (error) {
    console.error('[ReviewController] toggleHelpful error:', error);
    res.status(500).json({ message: 'Failed to update helpful vote' });
  }
};

/**
 * Aggregate review statistics for a book.
 *
 * Returns the average rating, total count, and a breakdown of how many
 * reviews fall into each star level (1–5). The frontend uses this for a
 * rating-distribution bar chart next to the detail page.
 */
export const getReviewStats = async (req, res) => {
  try {
    const { bookId } = req.params;

    const stats = await Review.aggregate([
      { $match: { book: reviewObjectId(bookId) } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let sum = 0;

    for (const bucket of stats) {
      const rating = bucket._id;
      breakdown[rating] = bucket.count;
      total += bucket.count;
      sum += rating * bucket.count;
    }

    const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

    res.json({
      average,
      total,
      breakdown,
    });
  } catch (error) {
    console.error('[ReviewController] getReviewStats error:', error);
    res.status(500).json({ message: 'Failed to fetch review statistics' });
  }
};

/**
 * Helper: cast a string to an ObjectId for aggregation pipelines.
 * A bad id should produce an empty match, not crash the server.
 */
function reviewObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}
