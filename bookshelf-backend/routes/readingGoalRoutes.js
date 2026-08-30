import express from 'express';
import {
  getGoal,
  setGoal,
  recordCompletion,
  undoCompletion,
  getHistory,
} from '../controllers/readingGoalController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateBody.js';
import { setGoalSchema } from '../validators/readingGoalValidators.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get the current year's goal (or ?year=YYYY)
router.get('/', getGoal);

// Set or update the yearly goal
router.put('/', validateBody(setGoalSchema), setGoal);

// Record that a book was finished this month
router.post('/complete', recordCompletion);

// Undo a book completion
router.post('/uncomplete', undoCompletion);

// Multi-year history
router.get('/history', getHistory);

export default router;
