import express from 'express';
import { markHelpful, deleteReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Review actions addressed by review id rather than by book.
 *
 * Two things were wrong here and neither could be noticed, because this router
 * is not mounted in `app.js` and nothing imported it.
 *
 * It imported `voteHelpful`, which `reviewController.js` does not export — the
 * name belongs to `repositories/reviewRepository.js`. That is a module link
 * error, so the file could not be loaded at all, and the day somebody mounted
 * it the server would have failed to start rather than served a bad response.
 *
 * And it declared its parameter as `:id` while both controllers read
 * `req.params.reviewId`, so every request through here would have looked up
 * `undefined`.
 *
 * These two routes duplicate `POST /:reviewId/helpful` and
 * `DELETE /:reviewId` in `reviewRoutes.js`, which is mounted and correct.
 * Worth folding together, but that is a decision about the API surface rather
 * than a repair, so this is left aligned with the controller it calls.
 */
const router = express.Router();

router.post('/:reviewId/helpful', protect, markHelpful);
router.delete('/:reviewId', protect, deleteReview);

export default router;
