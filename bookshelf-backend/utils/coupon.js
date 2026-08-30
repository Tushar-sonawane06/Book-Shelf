/**
 * Coupon eligibility and discount arithmetic.
 *
 * Pure functions over a plain coupon object, so the rule that decides how
 * much a customer is let off can be tested without MongoDB — and, more to the
 * point, so it can be run in two places and give the same answer both times.
 *
 * The bug this replaces: there was no shared rule. `validateCoupon` computed a
 * discount for the checkout page to display, and the payment intent was
 * created without ever hearing about it. The customer saw a discount row and
 * was charged as though it were not there. See #418.
 *
 * Everything here works in integer minor units, like utils/money.js, for the
 * same reason: the old expression was
 *
 *     Math.round((subtotal * coupon.discountValue) / 100 * 100) / 100
 *
 * — a float divided by 100 and multiplied by 100 to fake two decimal places.
 * A 15% discount on 1047 gives 157.04999999999998 before that rounding and
 * 157.05 after, and the value handed to Stripe would have been the first one.
 * In minor units it is one integer multiply and one deliberate round.
 */

import { MoneyError, applyRate, toMinorUnits } from './money.js';

/**
 * Why a coupon was refused.
 *
 * A machine-readable reason next to the human sentence, because the checkout
 * has to tell the two kinds apart: a code that is simply wrong is worth
 * showing to the customer, while a code that was valid when they typed it and
 * has since hit its usage limit has to be reported differently — by then they
 * are mid-checkout and the cart is still good.
 */
export const COUPON_REJECTION = Object.freeze({
  NOT_FOUND: 'not_found',
  INACTIVE: 'inactive',
  EXPIRED: 'expired',
  LIMIT_REACHED: 'limit_reached',
  BELOW_MINIMUM: 'below_minimum',
  MALFORMED: 'malformed',
});

/**
 * The longest code we will look up.
 *
 * `Coupon.code` is capped at 30 characters by the schema, so anything longer
 * cannot match a document and there is no reason to send it to the database.
 * `/api/coupons/validate` is unauthenticated.
 */
export const MAX_COUPON_CODE_LENGTH = 30;

export class CouponError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'CouponError';
    this.status = 400;
    this.reason = reason;
  }
}

/**
 * Normalise a code the way the schema stores it: trimmed and upper-cased.
 *
 * Returns `''` for anything that is not a usable string, so the caller has a
 * single falsy check rather than a type check and an emptiness check. Note
 * `String(undefined)` is `'undefined'` — a seven-character truthy string — so
 * the type has to be tested before the coercion, not after.
 */
export function normaliseCouponCode(raw) {
  if (typeof raw !== 'string') {
    return '';
  }

  return raw.trim().toUpperCase();
}

/**
 * The discount a coupon is worth against a subtotal, in minor units.
 *
 * Order of the two caps matters and is not arbitrary:
 *
 *   1. `maxDiscount` first — it is a cap on the coupon's generosity, and a
 *      "20% off, up to ₹200" coupon means 200 is the ceiling on the 20%.
 *   2. The subtotal second — a discount larger than the order would make the
 *      goods free and then start refunding the tax and the shipping.
 *
 * Doing it the other way round lets a fixed ₹500 coupon with a ₹200 cap pay
 * out 200 on a 100-rupee order.
 */
export function computeDiscountMinor(coupon, subtotalMinor) {
  if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor < 0) {
    throw new MoneyError(
      `Subtotal must be a non-negative integer of minor units, received ${subtotalMinor}`
    );
  }

  const value = Number(coupon?.discountValue);

  if (!Number.isFinite(value) || value < 0) {
    throw new CouponError(
      COUPON_REJECTION.MALFORMED,
      'This coupon is not configured correctly'
    );
  }

  let discountMinor;

  if (coupon.discountType === 'percentage') {
    // `applyRate` rounds half up, once, on an integer — the same rounding the
    // tax gets, so a discount and a tax of the same size never disagree by a
    // paisa for reasons nobody can reconstruct.
    discountMinor = applyRate(subtotalMinor, value / 100);
  } else if (coupon.discountType === 'fixed') {
    discountMinor = toMinorUnits(value);
  } else {
    throw new CouponError(
      COUPON_REJECTION.MALFORMED,
      'This coupon is not configured correctly'
    );
  }

  const maxDiscount = Number(coupon.maxDiscount) || 0;

  if (maxDiscount > 0) {
    discountMinor = Math.min(discountMinor, toMinorUnits(maxDiscount));
  }

  return Math.min(discountMinor, subtotalMinor);
}

/**
 * Decide whether a coupon may be used against a subtotal, and for how much.
 *
 * Returns `{ ok: true, discountMinor, coupon }` or `{ ok: false, reason,
 * message }` rather than throwing, because both answers are ordinary: a
 * customer mistyping a code is not an exceptional condition.
 *
 * `subtotalMinor` is the *server's* subtotal, priced from the catalogue.
 * That is the whole point of this function taking minor units — the previous
 * code read `req.body.subtotal`, so the number the discount was computed
 * against was whatever the client said it was, and a client that says its
 * cart is worth ₹100000 gets a percentage discount to match. See #418.
 *
 * `now` is injected so an expiry test does not have to sleep.
 */
export function evaluateCoupon(coupon, subtotalMinor, { now = new Date() } = {}) {
  if (!coupon) {
    return {
      ok: false,
      reason: COUPON_REJECTION.NOT_FOUND,
      message: 'Invalid coupon code',
    };
  }

  if (!coupon.active) {
    return {
      ok: false,
      reason: COUPON_REJECTION.INACTIVE,
      message: 'This coupon is no longer active',
    };
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    return {
      ok: false,
      reason: COUPON_REJECTION.EXPIRED,
      message: 'This coupon has expired',
    };
  }

  const maxUses = Number(coupon.maxUses) || 0;
  const usedCount = Number(coupon.usedCount) || 0;

  if (maxUses > 0 && usedCount >= maxUses) {
    return {
      ok: false,
      reason: COUPON_REJECTION.LIMIT_REACHED,
      message: 'This coupon has reached its usage limit',
    };
  }

  const minOrderMinor = toMinorUnits(Number(coupon.minOrderAmount) || 0);

  if (subtotalMinor < minOrderMinor) {
    return {
      ok: false,
      reason: COUPON_REJECTION.BELOW_MINIMUM,
      // The caller formats the amount — this module has no opinion about
      // which currency the shop trades in, and the `₹` that used to be
      // hardcoded into this sentence was wrong for a USD deployment. See #335.
      message: 'minimum order amount not met',
      minOrderAmount: Number(coupon.minOrderAmount) || 0,
    };
  }

  try {
    return { ok: true, coupon, discountMinor: computeDiscountMinor(coupon, subtotalMinor) };
  } catch (error) {
    if (error instanceof CouponError) {
      return { ok: false, reason: error.reason, message: error.message };
    }

    if (error instanceof MoneyError) {
      return {
        ok: false,
        reason: COUPON_REJECTION.MALFORMED,
        message: 'This coupon is not configured correctly',
      };
    }

    throw error;
  }
}

export default {
  COUPON_REJECTION,
  MAX_COUPON_CODE_LENGTH,
  CouponError,
  normaliseCouponCode,
  computeDiscountMinor,
  evaluateCoupon,
};
