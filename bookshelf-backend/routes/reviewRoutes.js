import express from 'express';
import {
  getBookReviews,
  getReviewBreakdown,
  createReview,
  updateReview,
  deleteReview,
  markHelpful,
  getMyReview,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateBody.js';
import {
  createReviewSchema,
  updateReviewSchema,
} from '../validators/reviewValidators.js';

const router = express.Router();

/**
 * Public routes — anyone can read reviews and breakdowns.
 *
 * The :bookId route is registered before /mine so Express does not
 * match the literal string "mine" as a book id.
 */
router.get('/:bookId/breakdown', getReviewBreakdown);
router.get('/:bookId/mine', protect, getMyReview);
router.get('/:bookId', getBookReviews);

/**
 * Authenticated routes — require a valid session cookie.
 */
router.post('/', protect, validateBody(createReviewSchema), createReview);
router.put('/:reviewId', protect, validateBody(updateReviewSchema), updateReview);
router.delete('/:reviewId', protect, deleteReview);
router.post('/:reviewId/helpful', protect, markHelpful);

export default router;
