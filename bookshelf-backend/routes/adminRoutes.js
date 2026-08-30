import express from 'express';
import {
  getDashboardStats,
  getSalesTrend,
  getMonthlyRevenue,
  getTopBooks,
  getRecentOrders,
  getOrderStatuses,
  getUserGrowth,
  getReviewStats,
} from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All admin routes require authentication AND the admin role.
 *
 * `protect` runs first (validates session, attaches `req.user`), then
 * `admin` checks `req.user.role === 'admin'`.
 */
router.use(protect, admin);

router.get('/stats', getDashboardStats);
router.get('/sales-trend', getSalesTrend);
router.get('/monthly-revenue', getMonthlyRevenue);
router.get('/top-books', getTopBooks);
router.get('/recent-orders', getRecentOrders);
router.get('/order-statuses', getOrderStatuses);
router.get('/user-growth', getUserGrowth);
router.get('/review-stats', getReviewStats);

export default router;
