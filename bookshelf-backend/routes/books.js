import express from 'express';
import {
  getAllBooks,
  getBook,
  getBookGenres,
  createBook,
  updateBook,
  deleteBook,
  updateBookStock,
} from '../controllers/bookController.js';
import reviewRoutes from './reviewRoutes.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateBody.js';
import { adminMutationLimiter } from '../middleware/rateLimiter.js';
import {
  createBookSchema,
  updateBookSchema,
  updateStockSchema,
} from '../validators/bookValidators.js';

const router = express.Router();

// Mount review sub-router
router.use('/:id/reviews', reviewRoutes);

router.get('/', getAllBooks);

// Must be registered before '/:id', otherwise Express matches "genres" as an
// id and this route becomes unreachable.
router.get('/genres', getBookGenres);

router.get('/:id', getBook);

router.post('/', protect, admin, adminMutationLimiter, validateBody(createBookSchema), createBook);
router.put('/:id', protect, admin, adminMutationLimiter, validateBody(updateBookSchema), updateBook);
router.delete('/:id', protect, admin, adminMutationLimiter, deleteBook);
router.patch('/:id/stock', protect, admin, adminMutationLimiter, validateBody(updateStockSchema), updateBookStock);

export default router;
