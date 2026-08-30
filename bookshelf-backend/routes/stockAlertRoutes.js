import express from 'express';
import {
  subscribe, unsubscribe, checkStatus, getMyAlerts, getAlertsForBook, markNotified,
} from '../controllers/stockAlertController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/mine', protect, getMyAlerts);
router.post('/', protect, subscribe);
router.get('/:bookId/status', protect, checkStatus);
router.delete('/:bookId', protect, unsubscribe);
router.get('/:bookId', protect, admin, getAlertsForBook);
router.post('/:bookId/notify', protect, admin, markNotified);

export default router;
