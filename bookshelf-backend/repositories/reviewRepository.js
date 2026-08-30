import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Book from '../models/Book.js';
import bookRepository from './bookRepository.js';

// In-memory store for fallback offline/test environments without MongoDB
const inMemoryReviews = [];

const isMongoConnected = () => mongoose.connection.readyState === 1;

class ReviewRepository {
  async hasUserPurchasedBook(userId, bookId) {
    if (!isMongoConnected() || !userId || !bookId) return false;
    try {
      const count = await Order.countDocuments({
        userId,
        paymentStatus: 'paid',
        'items.bookId': bookId,
      });
      return count > 0;
    } catch (err) {
      console.error('[reviewRepository] Error checking purchase history:', err.message);
      return false;
    }
  }

  async createReview({ bookId, userId, userName, rating, title, comment }) {
    const isVerifiedPurchase = await this.hasUserPurchasedBook(userId, bookId);
    const reviewPayload = {
      bookId,
      userId,
      userName,
      rating: Number(rating),
      title,
      comment,
      isVerifiedPurchase,
      helpfulVotes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongoConnected()) {
      const existing = await Review.findOne({ bookId, userId });
      if (existing) {
        const error = new Error('You have already submitted a review for this book.');
        error.status = 400;
        throw error;
      }
      const reviewDoc = await Review.create(reviewPayload);
      await this.recalculateBookRating(bookId);
      return reviewDoc;
    } else {
      // In-memory fallback
      const existing = inMemoryReviews.find(
        (r) => r.bookId === bookId && String(r.userId) === String(userId)
      );
      if (existing) {
        const error = new Error('You have already submitted a review for this book.');
        error.status = 400;
        throw error;
      }
      /*
       * A unique id, not a timestamp.
       *
       * This was `rev_${Date.now()}`, and two reviews stored in the same
       * millisecond therefore shared one. Everything downstream looks a review
       * up by id, so a collision meant voteHelpful crediting the wrong review,
       * and deleteReview finding the other user's document — either rejecting
       * a legitimate delete as unauthorised, or removing a review its author
       * had not asked to remove.
       *
       * A millisecond is not a rare window. Seeding, a burst of traffic, and
       * any test that creates two reviews in a row all land inside one; the
       * three tests in reviewSystem.test.js that caught this are the last of
       * those.
       */
      const reviewDoc = { ...reviewPayload, _id: `rev_${randomUUID()}` };
      inMemoryReviews.push(reviewDoc);
      await this.recalculateBookRating(bookId);
      return reviewDoc;
    }
  }

  async getReviewsByBookId(bookId, { page = 1, limit = 10, rating, sortBy = 'recent' } = {}) {
    if (isMongoConnected()) {
      const matchQuery = { bookId };
      if (rating && Number(rating) >= 1 && Number(rating) <= 5) {
        matchQuery.rating = Number(rating);
      }

      let sortOptions = { createdAt: -1 };
      if (sortBy === 'highest') sortOptions = { rating: -1, createdAt: -1 };
      if (sortBy === 'lowest') sortOptions = { rating: 1, createdAt: -1 };
      if (sortBy === 'helpful') sortOptions = { helpfulVotes: -1, createdAt: -1 };

      const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
      const parsedLimit = Math.max(1, Number(limit));

      const [reviews, total, stats] = await Promise.all([
        Review.find(matchQuery).sort(sortOptions).skip(skip).limit(parsedLimit).lean(),
        Review.countDocuments(matchQuery),
        this.getReviewStats(bookId),
      ]);

      return {
        reviews,
        total,
        page: Number(page),
        pages: Math.ceil(total / parsedLimit) || 1,
        stats,
      };
    } else {
      let filtered = inMemoryReviews.filter((r) => r.bookId === bookId);
      if (rating && Number(rating) >= 1 && Number(rating) <= 5) {
        filtered = filtered.filter((r) => r.rating === Number(rating));
      }

      if (sortBy === 'highest') filtered.sort((a, b) => b.rating - a.rating);
      else if (sortBy === 'lowest') filtered.sort((a, b) => a.rating - b.rating);
      else if (sortBy === 'helpful') filtered.sort((a, b) => b.helpfulVotes - a.helpfulVotes);
      else filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
      const parsedLimit = Math.max(1, Number(limit));

      const paginated = filtered.slice(skip, skip + parsedLimit);
      const stats = await this.getReviewStats(bookId);

      return {
        reviews: paginated,
        total: filtered.length,
        page: Number(page),
        pages: Math.ceil(filtered.length / parsedLimit) || 1,
        stats,
      };
    }
  }

  async getReviewStats(bookId) {
    if (isMongoConnected()) {
      const stats = await Review.aggregate([
        { $match: { bookId } },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
      ]);

      const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let totalCount = 0;
      let totalSum = 0;

      stats.forEach((item) => {
        ratingCounts[item._id] = item.count;
        totalCount += item.count;
        totalSum += item._id * item.count;
      });

      const averageRating = totalCount > 0 ? Number((totalSum / totalCount).toFixed(1)) : 0;

      return {
        averageRating,
        totalCount,
        breakdown: ratingCounts,
      };
    } else {
      const bookReviews = inMemoryReviews.filter((r) => r.bookId === bookId);
      const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let totalSum = 0;

      bookReviews.forEach((r) => {
        ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
        totalSum += r.rating;
      });

      const totalCount = bookReviews.length;
      const averageRating = totalCount > 0 ? Number((totalSum / totalCount).toFixed(1)) : 0;

      return {
        averageRating,
        totalCount,
        breakdown: ratingCounts,
      };
    }
  }

  async recalculateBookRating(bookId) {
    const stats = await this.getReviewStats(bookId);
    if (isMongoConnected()) {
      await Book.findOneAndUpdate(
        { id: bookId },
        { rating: stats.averageRating, reviewsCount: stats.totalCount }
      );
    }
    bookRepository.updateBook(bookId, {
      rating: stats.averageRating,
      reviewsCount: stats.totalCount,
    });
  }

  async voteHelpful(reviewId) {
    if (isMongoConnected()) {
      const updated = await Review.findByIdAndUpdate(
        reviewId,
        { $inc: { helpfulVotes: 1 } },
        { new: true }
      );
      return updated;
    } else {
      const review = inMemoryReviews.find((r) => String(r._id) === String(reviewId));
      if (review) {
        review.helpfulVotes = (review.helpfulVotes || 0) + 1;
        return review;
      }
      return null;
    }
  }

  async deleteReview(reviewId, userId, isAdmin = false) {
    if (isMongoConnected()) {
      const review = await Review.findById(reviewId);
      if (!review) return false;

      if (!isAdmin && String(review.userId) !== String(userId)) {
        const error = new Error('Not authorized to delete this review.');
        error.status = 403;
        throw error;
      }

      await Review.findByIdAndDelete(reviewId);
      await this.recalculateBookRating(review.bookId);
      return true;
    } else {
      const index = inMemoryReviews.findIndex((r) => String(r._id) === String(reviewId));
      if (index === -1) return false;

      const review = inMemoryReviews[index];
      if (!isAdmin && String(review.userId) !== String(userId)) {
        const error = new Error('Not authorized to delete this review.');
        error.status = 403;
        throw error;
      }

      inMemoryReviews.splice(index, 1);
      await this.recalculateBookRating(review.bookId);
      return true;
    }
  }

  clearMemoryCache() {
    inMemoryReviews.length = 0;
  }
}

export default new ReviewRepository();
