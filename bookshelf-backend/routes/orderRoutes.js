import express from 'express';
import {
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
} from '../controllers/orderController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { adminMutationLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// '/mine' must stay above '/:id' or Express matches "mine" as an order id.
router.route('/').get(protect, admin, getAllOrders);
router.route('/mine').get(protect, getMyOrders);
router.route('/:id').get(protect, getOrderById);
router.route('/:id/status').patch(protect, admin, adminMutationLimiter, updateOrderStatus);
router.route('/:id/cancel').post(protect, cancelOrder);

export default router;
