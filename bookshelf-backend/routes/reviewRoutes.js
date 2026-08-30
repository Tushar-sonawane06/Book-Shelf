import express from 'express';
import {
  getReviewsForBook,
  createOrUpdateReview,
  deleteReview,
  toggleHelpful,
  getReviewStats,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Public routes: reading reviews and stats does not require authentication.
 * Write operations require a session.
 *
 * The bookId is in the path because reviews are always scoped to a book.
 * The reviewId for update/delete/helpful is a separate param so the route
 * shape stays RESTful: /api/reviews/book/:bookId for listing, /api/reviews/:reviewId/actions for actions.
 */

// GET /api/reviews/book/:bookId — paginated reviews for a book
router.get('/book/:bookId', getReviewsForBook);

// GET /api/reviews/book/:bookId/stats — rating breakdown
router.get('/book/:bookId/stats', getReviewStats);

// POST /api/reviews/book/:bookId — create or update the caller's review
router.post('/book/:bookId', protect, createOrUpdateReview);

// DELETE /api/reviews/:reviewId — delete own review
router.delete('/:reviewId', protect, deleteReview);

// PUT /api/reviews/:reviewId/helpful — toggle helpful vote
router.put('/:reviewId/helpful', protect, toggleHelpful);

export default router;
