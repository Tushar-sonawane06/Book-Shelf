import orderRepository from '../repositories/orderRepository.js';
import { createPaymentIntent } from '../services/stripeService.js';
import {
  getBookById,
  updateInventoryWithOCC,
  restoreInventory,
} from '../repositories/bookRepository.js';
import { prepareCheckout, priceOrder, CheckoutValidationError } from '../utils/checkout.js';
import { getCurrencyConfig, formatAmount } from '../config/currency.js';
import Coupon from '../models/Coupon.js';
import { recordCouponUse } from './couponController.js';
import {
  MAX_COUPON_CODE_LENGTH,
  evaluateCoupon,
  normaliseCouponCode,
} from '../utils/coupon.js';

/**
 * @desc    Create a payment intent for a cart
 * @route   POST /api/payments/create-intent
 * @access  Public — guests can check out
 *
 * The route is unauthenticated, so every value in the body is hostile until
 * proved otherwise. Previously `items` was iterated straight off the request:
 * a missing array was a 500, and a negative quantity passed the stock check,
 * *added* inventory to books.json and produced an order with a negative
 * total. See #297.
 *
 * Order of operations, and why:
 *
 *   1. Validate and price. Nothing is written until the whole cart is known
 *      to be good — a request that fails here has touched nothing.
 *   2. Reserve inventory. Before the payment, because the alternative is
 *      overselling in the window between charging and reserving.
 *   3. Create the order and the payment intent. Anything that fails from
 *      here on releases the reservation before returning.
 *
 * The coupon, if there is one, is resolved between 1 and 2 — after the cart
 * is priced, because the discount depends on the server's subtotal, and
 * before anything is written, because a coupon problem should leave the same
 * nothing behind that a bad cart does.
 */
export const createIntent = async (req, res, next) => {
  const { items, shippingAddress, couponCode } = req.body ?? {};

  /*
   * One currency, read once, used for the price, for the payment intent and
   * for the record kept on the order. The intent used to be created with a
   * hardcoded 'usd' while the shop displayed every price with a `₹` sign, so
   * a customer saw ₹349 and was charged $349.00. See #335.
   */
  const currency = getCurrencyConfig();

  let checkout;

  try {
    checkout = prepareCheckout(items, getBookById, { currency });
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return res.status(400).json({
        message: 'Invalid checkout request',
        errors: error.errors,
      });
    }

    return next(error);
  }

  /*
   * Resolve the coupon against the subtotal the *server* just computed.
   *
   * Neither the code nor the discount is taken on trust. The frontend posts a
   * code and nothing else — it has no way to state an amount — and the
   * discount is recomputed here from the catalogue-priced cart. Previously no
   * coupon reached this function at all: the page displayed a discount from
   * `/api/coupons/validate` and the intent was created for the full amount.
   * See #418.
   */
  let coupon = null;
  let couponRejection = null;

  try {
    coupon = await resolveCoupon(couponCode, checkout.minorUnits.subtotal);
  } catch (error) {
    if (error?.couponRejection) {
      /*
       * A coupon that will not apply does not fail the checkout.
       *
       * The cart is valid and the customer is mid-payment; refusing the whole
       * order because a code expired between the preview and the submit would
       * lose the sale over the cheaper of the two problems. The order is
       * priced without it and the response says so, so the summary can tell
       * the customer why the discount is not there.
       */
      couponRejection = error.couponRejection;
    } else {
      return next(error);
    }
  }

  if (coupon) {
    // Re-price with the discount. Same cart, same catalogue lookup, so the
    // reservation below is unaffected — only the money changes.
    checkout = {
      ...checkout,
      ...priceOrder(checkout.items, {
        currency,
        discountMinor: coupon.discountMinor,
      }),
    };
  }

  // Reserve stock. A version mismatch or insufficient stock is the client's
  // answer (409), not a server fault.
  try {
    updateInventoryWithOCC(checkout.reservation);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }

  let reservationHeld = true;
  // Declared before `release` so the closure can mark it; it is only
  // assigned once the order has actually been created.
  let savedOrder;

  const release = (reason) => {
    if (!reservationHeld) {
      return;
    }

    reservationHeld = false;

    const { failed } = restoreInventory(checkout.reservation);

    // If the order exists, record that its hold is gone. Without this the
    // sweeper would find it still `pending` and restore the same lines a
    // second time. See #329.
    if (savedOrder && !savedOrder.reservationReleasedAt) {
      savedOrder.reservationReleasedAt = new Date();
    }

    if (failed.length > 0) {
      // Worth a loud log: the shop's stock is now understated and only a
      // human can reconcile it.
      console.error(
        `[checkout] released reservation after ${reason}, but ${failed.length} ` +
          'line(s) could not be restored:',
        failed
      );
    }
  };

  try {
    savedOrder = await orderRepository.create({
      userId: req.user ? req.user._id : null,
      items: checkout.orderItems,
      shippingAddress: shippingAddress || {},
      /*
       * Recorded on the order rather than resolved at render time. An order
       * placed before the shop changed currency was charged in the currency
       * it was placed in, and its history must keep saying so — reading the
       * *current* setting would silently relabel every historical total.
       */
      currency: checkout.currency,
      subtotal: checkout.subtotal,
      // What was actually taken off, and by which code. Recorded so the order
      // history shows the price that was paid rather than the list price.
      discount: checkout.discount,
      couponCode: coupon ? coupon.code : '',
      tax: checkout.tax,
      shipping: checkout.shipping,
      total: checkout.total,
      status: 'pending',
      paymentStatus: 'pending',
      /*
       * When the hold started. The reservation above is a durable change to
       * books.json, so it needs a durable record of when it happened —
       * otherwise nothing can tell an abandoned checkout from one the
       * customer is still filling in, and the stock is held forever. See
       * #329.
       */
      reservedAt: new Date(),
    });
  } catch (error) {
    release('the order could not be saved');
    return next(error);
  }

  try {
    /*
     * The integer minor-unit total goes to Stripe directly. Handing over the
     * major-unit number meant stripeService did its own `Math.round(x * 100)`
     * on a value money.js had already rounded exactly once — a second
     * rounding of an already-exact number, and one that assumed two decimal
     * places for every currency in the world.
     */
    const paymentIntent = await createPaymentIntent(
      checkout.minorUnits.total,
      currency.stripeCode,
      {
        orderId: savedOrder._id.toString(),
        userId: req.user ? req.user._id.toString() : 'guest',
        currency: currency.code,
      }
    );

    savedOrder.stripePaymentIntentId = paymentIntent.id;
    await orderRepository.save(savedOrder);

    /*
     * Count the redemption once the intent exists, not before.
     *
     * Before, and a customer who abandoned the page would have burned a use
     * of a single-use coupon they never redeemed. This is the first moment
     * the order is real enough to charge for.
     *
     * It is deliberately not awaited into the failure path: a coupon counter
     * that did not increment must never turn a successful checkout into an
     * error response. It is logged instead, which is what a human would need
     * to reconcile it.
     */
    if (coupon) {
      try {
        await recordCouponUse(coupon.code);
      } catch (error) {
        console.error(
          `[checkout] could not record use of coupon ${coupon.code} ` +
            `for order ${savedOrder._id}:`,
          error.message
        );
      }
    }

    // Past this point the reservation belongs to the order, and the webhook
    // is responsible for it: payment_intent.payment_failed and
    // payment_intent.canceled are where it gets released.
    reservationHeld = false;

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      orderId: savedOrder._id,
      // The currency is part of the amount, not a separate fact the frontend
      // is expected to already know. The checkout summary renders what this
      // says rather than what it assumes.
      currency: checkout.currency,
      amount: {
        currency: checkout.currency,
        subtotal: checkout.subtotal,
        discount: checkout.discount,
        tax: checkout.tax,
        shipping: checkout.shipping,
        total: checkout.total,
      },
      /*
       * The applied code, or null. The checkout summary renders its discount
       * row from this and from `amount.discount` — never from what the client
       * worked out for itself — so the number on screen is by construction
       * the number being charged.
       */
      coupon: coupon ? { code: coupon.code, discount: checkout.discount } : null,
      // Present only when a code was sent and could not be applied.
      couponError: couponRejection,
    });
  } catch (error) {
    release('the payment intent could not be created');

    // Leave a trace rather than an order stuck at 'pending' forever with no
    // payment intent attached to it.
    try {
      savedOrder.status = 'payment_failed';
      savedOrder.paymentStatus = 'failed';
      await orderRepository.save(savedOrder);
    } catch (saveError) {
      console.error(
        `[checkout] could not mark order ${savedOrder._id} as failed:`,
        saveError
      );
    }

    console.error(
      `[checkout] payment intent failed for order ${savedOrder._id} ` +
        `(total ${formatAmount(checkout.total, currency)}):`,
      error.message
    );

    return next(error);
  }
};

/**
 * Look a coupon up and decide what it is worth against a priced cart.
 *
 * Returns `null` when no code was sent — the ordinary case — and throws an
 * error carrying `couponRejection` when a code was sent but will not apply,
 * so the caller can tell "no coupon" from "that coupon is no good" without
 * inspecting a result shape.
 *
 * @param {unknown} rawCode      whatever arrived in the request body
 * @param {number}  subtotalMinor the server's subtotal, in minor units
 */
async function resolveCoupon(rawCode, subtotalMinor) {
  const code = normaliseCouponCode(rawCode);

  if (!code) {
    return null;
  }

  if (code.length > MAX_COUPON_CODE_LENGTH) {
    throw couponRejected('not_found', 'Invalid coupon code');
  }

  const coupon = await Coupon.findOne({ code });
  const outcome = evaluateCoupon(coupon, subtotalMinor);

  if (!outcome.ok) {
    throw couponRejected(outcome.reason, outcome.message);
  }

  return { code: coupon.code, discountMinor: outcome.discountMinor };
}

function couponRejected(reason, message) {
  const error = new Error(`Coupon rejected: ${message}`);
  error.couponRejection = { reason, message };
  return error;
}
