import Coupon from '../models/Coupon.js';
import {
  COUPON_REJECTION,
  MAX_COUPON_CODE_LENGTH,
  evaluateCoupon,
  normaliseCouponCode,
} from '../utils/coupon.js';
import { toMajorUnits, toMinorUnits } from '../utils/money.js';
import { formatAmount, getCurrencyConfig } from '../config/currency.js';

/**
 * @desc    Preview what a coupon is worth against a cart
 * @route   POST /api/coupons/validate
 * @access  Public
 *
 * A *preview*, and only a preview. It answers the checkout page's question
 * "is this code any good, and roughly what will it save me" so the customer
 * gets an answer while typing rather than after submitting.
 *
 * It does not decide what anyone is charged. The subtotal in the body comes
 * from the client and cannot be trusted with a price, so the binding
 * calculation happens again inside `createIntent` against the server's own
 * priced cart. The two agree because both call `evaluateCoupon`, which is why
 * that lives in utils/coupon.js rather than here. See #418.
 */
export const validateCoupon = async (req, res, next) => {
  try {
    const code = normaliseCouponCode(req.body?.code);
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    if (code.length > MAX_COUPON_CODE_LENGTH) {
      // `Coupon.code` is capped at 30, so a longer string cannot match a
      // document. The route is unauthenticated; no reason to ask the database.
      return res.status(404).json({ message: 'Invalid coupon code' });
    }

    const coupon = await Coupon.findOne({ code });

    const currency = getCurrencyConfig();
    const subtotal = Number(req.body?.subtotal);
    const subtotalMinor = toMinorUnits(
      Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0
    );

    const outcome = evaluateCoupon(coupon, subtotalMinor);

    if (!outcome.ok) {
      const status = outcome.reason === COUPON_REJECTION.NOT_FOUND ? 404 : 400;

      // The minimum-order sentence is assembled here rather than in
      // utils/coupon.js, which has no business knowing the shop's currency.
      // It used to hardcode a `₹`, which was wrong for a USD deployment.
      const message =
        outcome.reason === COUPON_REJECTION.BELOW_MINIMUM
          ? `Minimum order amount of ${formatAmount(outcome.minOrderAmount, currency)} required`
          : outcome.message;

      return res.status(status).json({ message, reason: outcome.reason });
    }

    res.json({
      valid: true,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discount: toMajorUnits(outcome.discountMinor),
      currency: currency.code,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Count one redemption against a coupon.
 *
 * Was exported and called from nowhere, so `usedCount` never moved and the
 * `maxUses` check in `validateCoupon` could never fire — a single-use coupon
 * was infinitely reusable. `createIntent` calls it now. See #418.
 *
 * `$inc` rather than read-modify-write so two checkouts redeeming the last
 * use of a coupon at the same time cannot both read the same `usedCount`.
 * The increment is atomic; the check that precedes it is not, so a coupon can
 * still be overshot by one under a genuine race. That is the right trade here
 * — refusing a paid-for discount after the card has been charged is worse
 * than honouring one extra redemption.
 */
export const recordCouponUse = async (code) => {
  const normalised = normaliseCouponCode(code);

  if (!normalised) {
    return null;
  }

  return Coupon.findOneAndUpdate(
    { code: normalised },
    { $inc: { usedCount: 1 } },
    { new: true }
  );
};

// ── Admin: list all coupons ─────────────────────────────────────────────────

export const listCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json(coupons.map((c) => ({ ...c, id: c._id.toString() })));
  } catch (error) {
    next(error);
  }
};

// ── Admin: create a coupon ──────────────────────────────────────────────────

export const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ message: 'Coupon created', coupon: { ...coupon.toObject(), id: coupon._id.toString() } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A coupon with that code already exists' });
    next(error);
  }
};

// ── Admin: update a coupon ──────────────────────────────────────────────────

export const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ message: 'Coupon updated', coupon: { ...coupon, id: coupon._id.toString() } });
  } catch (error) {
    next(error);
  }
};

// ── Admin: delete a coupon ──────────────────────────────────────────────────

export const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    next(error);
  }
};
