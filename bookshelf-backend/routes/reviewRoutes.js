import express from 'express';
import {
  createReview,
  getBookReviews,
  getReview,
  updateReview,
  deleteReview,
  toggleHelpful,
  getMyReviewForBook,
  adminGetBookReviews,
  adminToggleVisibility,
} from '../controllers/reviewController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateBody.js';
import { createReviewSchema, updateReviewSchema } from '../validators/reviewValidators.js';

const router = express.Router();

// ── Authenticated ──────────────────────────────────────────────────────────

// Create a review (validates bookId + rating + optional title/body)
router.post('/', protect, validateBody(createReviewSchema), createReview);

// ── Public ─────────────────────────────────────────────────────────────────

// All visible reviews for a book, with pagination and sorting
router.get('/book/:bookId', getBookReviews);

// A single review
router.get('/:reviewId', getReview);

// ── Authenticated — owner actions ───────────────────────────────────────────

// Update own review
router.put('/:reviewId', protect, validateBody(updateReviewSchema), updateReview);

// Delete own review
router.delete('/:reviewId', protect, deleteReview);

// Toggle "helpful" vote
router.post('/:reviewId/helpful', protect, toggleHelpful);

// Check if current user has reviewed a specific book
router.get('/book/:bookId/mine', protect, getMyReviewForBook);

// ── Admin ──────────────────────────────────────────────────────────────────

// Admin: all reviews (including hidden) for a book
router.get('/admin/book/:bookId', protect, admin, adminGetBookReviews);

// Admin: toggle review visibility
router.patch('/:reviewId/visibility', protect, admin, adminToggleVisibility);

export default router;
