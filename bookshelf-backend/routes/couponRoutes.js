import express from 'express';
import {
  validateCoupon, listCoupons, createCoupon, updateCoupon, deleteCoupon,
} from '../controllers/couponController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public: validate a code
router.post('/validate', validateCoupon);

// Admin: CRUD
router.get('/', protect, admin, listCoupons);
router.post('/', protect, admin, createCoupon);
router.put('/:id', protect, admin, updateCoupon);
router.delete('/:id', protect, admin, deleteCoupon);

export default router;
