import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateCoupon } from '../utils/coupon.js';
import { toMajorUnits, toMinorUnits } from '../utils/money.js';

/**
 * Coupon validation, as the controller performs it.
 *
 * This file used to define its own `computeDiscount` at the top and test
 * that. The copy and the shipped controller then drifted — and because the
 * copy was the only thing under test, the suite stayed green while
 * `validateCoupon` computed a discount that nothing ever charged. See #418.
 *
 * The helper below now calls the real `evaluateCoupon`, the same function the
 * controller and `createIntent` both use, and converts at the boundary so
 * these cases can keep speaking in whole rupees.
 *
 * The deeper coverage — rounding, cap ordering, how the discount lands in the
 * total — is in tests/coupon.test.js.
 */
function computeDiscount(coupon, subtotal) {
  const outcome = evaluateCoupon(coupon, toMinorUnits(subtotal));

  return outcome.ok
    ? { valid: true, discount: toMajorUnits(outcome.discountMinor) }
    : { valid: false, reason: outcome.reason };
}

describe('computeDiscount', () => {
  it('calculates percentage discount correctly', () => {
    const result = computeDiscount({ active: true, discountType: 'percentage', discountValue: 10, minOrderAmount: 0, maxDiscount: 0, maxUses: 0, usedCount: 0 }, 200);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.discount, 20);
  });

  it('calculates fixed discount correctly', () => {
    const result = computeDiscount({ active: true, discountType: 'fixed', discountValue: 50, minOrderAmount: 0, maxDiscount: 0, maxUses: 0, usedCount: 0 }, 200);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.discount, 50);
  });

  it('caps discount at subtotal', () => {
    const result = computeDiscount({ active: true, discountType: 'fixed', discountValue: 500, minOrderAmount: 0, maxDiscount: 0, maxUses: 0, usedCount: 0 }, 100);
    assert.strictEqual(result.discount, 100);
  });

  it('applies maxDiscount cap', () => {
    const result = computeDiscount({ active: true, discountType: 'percentage', discountValue: 50, minOrderAmount: 0, maxDiscount: 30, maxUses: 0, usedCount: 0 }, 200);
    assert.strictEqual(result.discount, 30);
  });

  it('rejects inactive coupons', () => {
    const result = computeDiscount({ active: false, discountType: 'fixed', discountValue: 10, minOrderAmount: 0, maxDiscount: 0, maxUses: 0, usedCount: 0 }, 100);
    assert.strictEqual(result.valid, false);
  });

  it('rejects expired coupons', () => {
    const past = new Date(Date.now() - 86400000);
    const result = computeDiscount({ active: true, expiresAt: past, discountType: 'fixed', discountValue: 10, minOrderAmount: 0, maxDiscount: 0, maxUses: 0, usedCount: 0 }, 100);
    assert.strictEqual(result.valid, false);
  });

  it('rejects when maxUses reached', () => {
    const result = computeDiscount({ active: true, discountType: 'fixed', discountValue: 10, minOrderAmount: 0, maxDiscount: 0, maxUses: 5, usedCount: 5 }, 100);
    assert.strictEqual(result.valid, false);
  });

  it('rejects when subtotal below minimum', () => {
    const result = computeDiscount({ active: true, discountType: 'fixed', discountValue: 10, minOrderAmount: 200, maxDiscount: 0, maxUses: 0, usedCount: 0 }, 100);
    assert.strictEqual(result.valid, false);
  });

  it('reports a machine-readable reason, not just a boolean', () => {
    // The checkout needs to tell "you mistyped it" from "it ran out while you
    // were filling in your address", which reads the same to a customer and
    // means something different.
    assert.strictEqual(
      computeDiscount({ active: false, discountType: 'fixed', discountValue: 10, minOrderAmount: 0, maxDiscount: 0, maxUses: 0, usedCount: 0 }, 100).reason,
      'inactive'
    );
    assert.strictEqual(
      computeDiscount({ active: true, discountType: 'fixed', discountValue: 10, minOrderAmount: 200, maxDiscount: 0, maxUses: 0, usedCount: 0 }, 100).reason,
      'below_minimum'
    );
  });
});
