import express from 'express';
import {
  getCollections, getCollection, createCollection, updateCollection,
  deleteCollection, addBook, removeBook,
} from '../controllers/collectionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateBody.js';
import {
  addBookSchema,
  createCollectionSchema,
  updateCollectionSchema,
} from '../validators/collectionValidators.js';

const router = express.Router();

router.use(protect);

/*
 * Every write goes through `validateBody`, as the auth and wishlist routes
 * already did. These three were the last ones in the API without it, and the
 * controller behind them called `.trim()` on values it had not type-checked.
 * See #419.
 */
router.route('/')
  .get(getCollections)
  .post(validateBody(createCollectionSchema), createCollection);

router.route('/:id')
  .get(getCollection)
  .put(validateBody(updateCollectionSchema), updateCollection)
  .delete(deleteCollection);

router.post('/:id/books', validateBody(addBookSchema), addBook);
router.delete('/:id/books/:bookId', removeBook);

export default router;
