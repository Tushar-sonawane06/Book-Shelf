import express from 'express';
import {
  createAlert,
  getMyAlerts,
  checkAlert,
  toggleAlert,
  updateAlert,
  deleteAlert,
  deleteByBookId,
  checkAllAlerts,
} from '../controllers/priceAlertController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateBody.js';
import { createAlertSchema } from '../validators/priceAlertValidators.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ── Read ───────────────────────────────────────────────────────────────────

// User's price alerts, optionally filtered by ?active=true|false
router.get('/', getMyAlerts);

// Check if the user has an active alert for a specific book
router.get('/check/:bookId', checkAlert);

// ── Write ──────────────────────────────────────────────────────────────────

// Create (or update existing) price alert
router.post('/', validateBody(createAlertSchema), createAlert);

// Update target price
router.put('/:alertId', updateAlert);

// Pause/resume alert
router.patch('/:alertId/toggle', toggleAlert);

// Delete by entry id
router.delete('/:alertId', deleteAlert);

// Delete by bookId
router.delete('/book/:bookId', deleteByBookId);

// ── Admin ──────────────────────────────────────────────────────────────────

// Admin: scan all active alerts and mark triggered ones
router.post('/admin/check', protect, admin, checkAllAlerts);

export default router;
