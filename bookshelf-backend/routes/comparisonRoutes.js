import express from 'express';
import { getComparison } from '../controllers/comparisonController.js';

const router = express.Router();

// Compare multiple books side by side
router.get('/', getComparison);

export default router;
