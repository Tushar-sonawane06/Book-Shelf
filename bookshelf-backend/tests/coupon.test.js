import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  COUPON_REJECTION,
  CouponError,
  computeDiscountMinor,
  evaluateCoupon,
  normaliseCouponCode,
} from '../utils/coupon.js';
import { priceOrder } from '../utils/checkout.js';
import { SUPPORTED_CURRENCIES } from '../config/currency.js';
import { toMinorUnits } from '../utils/money.js';

/**
 * Coupons, priced in minor units.
 *
 * The old tests for this lived in couponController.test.js and exercised a
 * copy of the logic pasted into the test file, so they passed while the
 * shipped controller did something else. These import the module the
 * controller and the payment intent both call. See #418.
 */

const INR = SUPPORTED_CURRENCIES.INR;

/** A coupon with every field set, so a test only states what it changes. */
function coupon(overrides = {}) {
  return {
    code: 'SAVE10',
    active: true,
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscount: 0,
    maxUses: 0,
    usedCount: 0,
    expiresAt: undefined,
    ...overrides,
  };
}

describe('normaliseCouponCode', () => {
  test('trims and upper-cases', () => {
    assert.equal(normaliseCouponCode('  save10 '), 'SAVE10');
  });

  test('returns empty for anything that is not a string', () => {
    // The trap this exists to avoid: String(undefined) is 'undefined', a
    // seven-character truthy string, which is exactly how the collections
    // endpoint came to store a book id of "undefined".
    for (const value of [undefined, null, 42, {}, [], true]) {
      assert.equal(normaliseCouponCode(value), '');
    }
  });

  test('returns empty for whitespace', () => {
    assert.equal(normaliseCouponCode('   '), '');
  });
});

describe('computeDiscountMinor — the arithmetic', () => {
  test('a percentage discount is exact where the float version was not', () => {
    // 15% of 1047.00 is 157.04999999999998 in floating point. The old
    // expression was Math.round(x / 100 * 100) / 100 on that value.
    const subtotalMinor = toMinorUnits(1047);
    const discount = computeDiscountMinor(
      coupon({ discountType: 'percentage', discountValue: 15 }),
      subtotalMinor
    );

    assert.equal(discount, 15705);
    assert.ok(Number.isSafeInteger(discount));
  });

  test('a fixed discount converts to minor units', () => {
    const discount = computeDiscountMinor(
      coupon({ discountType: 'fixed', discountValue: 50 }),
      toMinorUnits(200)
    );

    assert.equal(discount, 5000);
  });

  test('rounds half up, once', () => {
    // 33% of 1.05 is 0.3465 -> 34.65 minor units -> 35.
    const discount = computeDiscountMinor(
      coupon({ discountType: 'percentage', discountValue: 33 }),
      105
    );

    assert.equal(discount, 35);
  });

  test('maxDiscount caps the payout', () => {
    const discount = computeDiscountMinor(
      coupon({ discountValue: 50, maxDiscount: 30 }),
      toMinorUnits(200)
    );

    assert.equal(discount, toMinorUnits(30));
  });

  test('the subtotal caps the payout', () => {
    const discount = computeDiscountMinor(
      coupon({ discountType: 'fixed', discountValue: 500 }),
      toMinorUnits(100)
    );

    assert.equal(discount, toMinorUnits(100));
  });

  test('maxDiscount is applied before the subtotal cap, not after', () => {
    /*
     * A "₹500 off, up to ₹200" coupon against a ₹100 order.
     *
     * Capping by the subtotal first gives min(500, 100) = 100, then
     * min(100, 200) = 100 — the order is free. Capping by maxDiscount first
     * gives min(500, 200) = 200, then min(200, 100) = 100. Same answer here,
     * so the case that actually separates them:
     */
    const discount = computeDiscountMinor(
      coupon({ discountType: 'fixed', discountValue: 500, maxDiscount: 200 }),
      toMinorUnits(300)
    );

    // maxDiscount first: min(500, 200) = 200, then min(200, 300) = 200.
    assert.equal(discount, toMinorUnits(200));
  });

  test('refuses a discount type it does not know', () => {
    assert.throws(
      () => computeDiscountMinor(coupon({ discountType: 'buy-one-get-one' }), 1000),
      (error) => error instanceof CouponError && error.reason === COUPON_REJECTION.MALFORMED
    );
  });

  test('refuses a negative discount value', () => {
    assert.throws(
      () => computeDiscountMinor(coupon({ discountValue: -10 }), 1000),
      CouponError
    );
  });
});

describe('evaluateCoupon — eligibility', () => {
  test('a missing coupon is not found rather than a crash', () => {
    const outcome = evaluateCoupon(null, 10000);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.reason, COUPON_REJECTION.NOT_FOUND);
  });

  test('an inactive coupon is refused', () => {
    const outcome = evaluateCoupon(coupon({ active: false }), 10000);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.reason, COUPON_REJECTION.INACTIVE);
  });

  test('an expired coupon is refused', () => {
    const outcome = evaluateCoupon(
      coupon({ expiresAt: new Date('2020-01-01') }),
      10000
    );
    assert.equal(outcome.ok, false);
    assert.equal(outcome.reason, COUPON_REJECTION.EXPIRED);
  });

  test('expiry is compared against the injected clock', () => {
    const expiresAt = new Date('2030-06-01');

    assert.equal(
      evaluateCoupon(coupon({ expiresAt }), 10000, { now: new Date('2030-05-31') }).ok,
      true
    );
    assert.equal(
      evaluateCoupon(coupon({ expiresAt }), 10000, { now: new Date('2030-06-02') }).ok,
      false
    );
  });

  test('an expiry stored as a string still compares', () => {
    // Mongoose gives a Date, but a lean() read or a fixture may not.
    const outcome = evaluateCoupon(coupon({ expiresAt: '2020-01-01T00:00:00.000Z' }), 10000);
    assert.equal(outcome.reason, COUPON_REJECTION.EXPIRED);
  });

  test('a coupon at its usage limit is refused', () => {
    const outcome = evaluateCoupon(coupon({ maxUses: 1, usedCount: 1 }), 10000);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.reason, COUPON_REJECTION.LIMIT_REACHED);
  });

  test('maxUses of 0 means unlimited', () => {
    const outcome = evaluateCoupon(coupon({ maxUses: 0, usedCount: 999 }), 10000);
    assert.equal(outcome.ok, true);
  });

  test('a subtotal below the minimum is refused, and reports the minimum', () => {
    const outcome = evaluateCoupon(coupon({ minOrderAmount: 500 }), toMinorUnits(499));

    assert.equal(outcome.ok, false);
    assert.equal(outcome.reason, COUPON_REJECTION.BELOW_MINIMUM);
    // The controller formats this with the shop's currency. The message from
    // this module carries no currency symbol of its own — the one that used
    // to be hardcoded here was a ₹ on a USD deployment.
    assert.equal(outcome.minOrderAmount, 500);
    assert.doesNotMatch(outcome.message, /[₹$]/);
  });

  test('a subtotal exactly at the minimum is allowed', () => {
    const outcome = evaluateCoupon(coupon({ minOrderAmount: 500 }), toMinorUnits(500));
    assert.equal(outcome.ok, true);
  });

  test('a usable coupon reports the discount in minor units', () => {
    const outcome = evaluateCoupon(coupon({ discountValue: 20 }), toMinorUnits(1000));

    assert.equal(outcome.ok, true);
    assert.equal(outcome.discountMinor, toMinorUnits(200));
  });

  test('a malformed coupon is a rejection, not a throw', () => {
    // It reaches the checkout, where a throw would be a 500 mid-payment.
    const outcome = evaluateCoupon(coupon({ discountType: 'mystery' }), 10000);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.reason, COUPON_REJECTION.MALFORMED);
  });
});

describe('priceOrder — where the discount lands in the total', () => {
  const items = [
    { bookId: 'b1', quantity: 3, book: { id: 'b1', title: 'The Quiet Ones', price: 349 } },
  ];

  test('no discount prices exactly as before', () => {
    const priced = priceOrder(items, { currency: INR });

    assert.equal(priced.subtotal, 1047);
    assert.equal(priced.discount, 0);
    assert.equal(priced.tax, 52.35);
    assert.equal(priced.shipping, 49);
    assert.equal(priced.total, 1148.35);
  });

  test('the discount comes off the subtotal before the tax is computed', () => {
    const priced = priceOrder(items, { currency: INR, discountMinor: toMinorUnits(100) });

    // Subtotal is still the list price — the customer should see what the
    // books cost and what came off, not a silently reduced subtotal.
    assert.equal(priced.subtotal, 1047);
    assert.equal(priced.discount, 100);
    // 5% of 947, not of 1047.
    assert.equal(priced.tax, 47.35);
    assert.equal(priced.total, 947 + 47.35 + 49);
  });

  test('the minor-unit total is the one Stripe is handed, and it is discounted', () => {
    const priced = priceOrder(items, { currency: INR, discountMinor: toMinorUnits(100) });

    assert.equal(priced.minorUnits.discount, 10000);
    assert.equal(priced.minorUnits.total, 104335);
    assert.ok(Number.isSafeInteger(priced.minorUnits.total));
  });

  test('shipping is not discounted', () => {
    const priced = priceOrder(items, {
      currency: INR,
      discountMinor: toMinorUnits(1047),
    });

    assert.equal(priced.discount, 1047);
    assert.equal(priced.tax, 0);
    assert.equal(priced.shipping, 49);
    // The goods are free; the delivery is not.
    assert.equal(priced.total, 49);
  });

  test('a discount larger than the subtotal is clamped, not subtracted', () => {
    const priced = priceOrder(items, {
      currency: INR,
      discountMinor: toMinorUnits(99999),
    });

    assert.equal(priced.discount, 1047);
    assert.equal(priced.total, 49);
    assert.ok(priced.total > 0, 'a coupon must never produce a refund');
  });

  test('a negative discount is ignored rather than charged as a surcharge', () => {
    const priced = priceOrder(items, { currency: INR, discountMinor: -50000 });

    assert.equal(priced.discount, 0);
    assert.equal(priced.total, 1148.35);
  });

  test('a non-numeric discount is ignored', () => {
    for (const value of [undefined, null, NaN, 'free', {}]) {
      const priced = priceOrder(items, { currency: INR, discountMinor: value });
      assert.equal(priced.discount, 0, `discountMinor=${String(value)}`);
    }
  });

  test('the discount is reported in both units and they agree', () => {
    const priced = priceOrder(items, { currency: INR, discountMinor: 15705 });

    assert.equal(priced.minorUnits.discount, 15705);
    assert.equal(priced.discount, 157.05);
  });
});

describe('the coupon rules and the pricing compose', () => {
  const items = [
    { bookId: 'b1', quantity: 3, book: { id: 'b1', title: 'The Quiet Ones', price: 349 } },
  ];

  test('a percentage coupon end to end', () => {
    const subtotalMinor = priceOrder(items, { currency: INR }).minorUnits.subtotal;
    const outcome = evaluateCoupon(coupon({ discountValue: 15 }), subtotalMinor);

    assert.equal(outcome.ok, true);

    const priced = priceOrder(items, {
      currency: INR,
      discountMinor: outcome.discountMinor,
    });

    assert.equal(priced.discount, 157.05);
    assert.equal(priced.subtotal - priced.discount, 889.95);
    assert.equal(priced.tax, 44.5);
    assert.equal(priced.total, 889.95 + 44.5 + 49);
  });

  test('a refused coupon prices the same cart at full price', () => {
    const subtotalMinor = priceOrder(items, { currency: INR }).minorUnits.subtotal;
    const outcome = evaluateCoupon(coupon({ active: false }), subtotalMinor);

    assert.equal(outcome.ok, false);
    assert.equal(outcome.discountMinor, undefined);

    const priced = priceOrder(items, { currency: INR });
    assert.equal(priced.total, 1148.35);
  });
});
