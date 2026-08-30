import express from 'express';
import {
  addBook,
  getMyList,
  checkBook,
  updateEntry,
  removeBook,
  removeByBookId,
  reorderEntries,
  getStats,
} from '../controllers/readingListController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateBody.js';
import { addBookSchema, updateBookSchema } from '../validators/readingListValidators.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ── Read ───────────────────────────────────────────────────────────────────

// User's reading list, optionally filtered by ?shelf=
router.get('/', getMyList);

// Reading statistics summary
router.get('/stats', getStats);

// Check if a specific book is on the list
router.get('/check/:bookId', checkBook);

// ── Write ──────────────────────────────────────────────────────────────────

// Add or move a book (upserts — same book on list moves to new shelf)
router.post('/', validateBody(addBookSchema), addBook);

// Reorder entries within a shelf
router.put('/reorder', reorderEntries);

// Update an entry (notes, rating, progress, shelf)
router.put('/:entryId', validateBody(updateBookSchema), updateEntry);

// Remove by entry id
router.delete('/:entryId', removeBook);

// Remove by bookId (convenience endpoint for toggle UIs)
router.delete('/book/:bookId', removeByBookId);

export default router;
