/**
 * Checkout validation and pricing.
 *
 * Pure functions over a plain cart and a lookup of the catalogue, so the
 * rules that decide what a customer is charged can be tested without Stripe,
 * without MongoDB and without an HTTP server.
 *
 * The bug this replaces: `createIntent` read `items` straight off the request
 * body and used `item.quantity` unchecked. A quantity of -5 passed the stock
 * check (`8 < -5` is false), *increased* the inventory in books.json by five,
 * and produced an order with a negative total. See #297.
 */

import {
  MoneyError,
  applyRate,
  multiply,
  sum,
  toMajorUnits,
  toMinorUnits,
} from './money.js';
import { getCurrencyConfig } from '../config/currency.js';

/** 5% mock tax, as before. Kept here so the number has one home. */
export const TAX_RATE = 0.05;

/**
 * Flat shipping, in major units of the shop's currency.
 *
 * This was a hardcoded `5.99` — a dollar figure, charged unchanged next to a
 * catalogue priced in rupees, because nothing in the pricing path knew what
 * currency it was working in. It comes from config/currency.js now, which is
 * the same place the payment intent gets its currency from. See #335.
 *
 * Read through a function rather than exported as a constant: the config is
 * resolved lazily, and a module-scope read would fix the value at import time
 * and defeat that.
 */
export function defaultShipping(currency = getCurrencyConfig()) {
  return currency.defaultShipping;
}

/**
 * Bounds. None of these are business rules — they are the limits past which a
 * request stops being a plausible cart and starts being someone probing the
 * endpoint. A public, unauthenticated route needs all of them.
 */
export const MAX_LINE_ITEMS = 50;
export const MAX_QUANTITY_PER_LINE = 20;

export class CheckoutValidationError extends Error {
  constructor(errors) {
    const summary = errors.map((error) => error.message).join('; ');
    super(`Invalid checkout request: ${summary}`);

    this.name = 'CheckoutValidationError';
    this.status = 400;
    this.errors = errors;
  }
}

function fieldError(field, message) {
  return { field, message };
}

/**
 * Validate the raw `items` array and normalise it.
 *
 * Collects every problem rather than stopping at the first, so a broken
 * client gets one useful response instead of a sequence of them.
 *
 * `lookupBook` is passed in rather than imported so this module has no
 * dependency on the repository, and so a test can describe a catalogue in
 * three lines.
 */
export function validateItems(rawItems, lookupBook) {
  const errors = [];

  if (rawItems === undefined || rawItems === null) {
    throw new CheckoutValidationError([
      fieldError('items', 'items is required'),
    ]);
  }

  if (!Array.isArray(rawItems)) {
    throw new CheckoutValidationError([
      fieldError('items', 'items must be an array'),
    ]);
  }

  if (rawItems.length === 0) {
    throw new CheckoutValidationError([
      fieldError('items', 'items must contain at least one entry'),
    ]);
  }

  if (rawItems.length > MAX_LINE_ITEMS) {
    throw new CheckoutValidationError([
      fieldError(
        'items',
        `items must contain at most ${MAX_LINE_ITEMS} entries, received ${rawItems.length}`
      ),
    ]);
  }

  const normalised = [];
  // A cart with the same book on two lines is not malicious, but it has to be
  // collapsed before the stock check — otherwise two lines of 5 each pass
  // against an inventory of 8 and oversell by two.
  const seen = new Map();

  rawItems.forEach((item, index) => {
    const field = `items[${index}]`;

    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(fieldError(field, `${field} must be an object`));
      return;
    }

    // The frontend has sent both shapes over time. Accept either, but require
    // exactly one usable id.
    const rawBookId = item.bookId ?? item.id;

    if (typeof rawBookId !== 'string' || rawBookId.trim() === '') {
      errors.push(
        fieldError(`${field}.bookId`, `${field}.bookId must be a non-empty string`)
      );
      return;
    }

    const bookId = rawBookId.trim();
    const quantity = item.quantity;

    if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
      errors.push(
        fieldError(
          `${field}.quantity`,
          `${field}.quantity must be a number, received ${describe(quantity)}`
        )
      );
      return;
    }

    if (!Number.isInteger(quantity)) {
      errors.push(
        fieldError(
          `${field}.quantity`,
          `${field}.quantity must be a whole number, received ${quantity}`
        )
      );
      return;
    }

    // The one that mattered. A negative quantity used to add stock.
    if (quantity < 1) {
      errors.push(
        fieldError(
          `${field}.quantity`,
          `${field}.quantity must be at least 1, received ${quantity}`
        )
      );
      return;
    }

    if (quantity > MAX_QUANTITY_PER_LINE) {
      errors.push(
        fieldError(
          `${field}.quantity`,
          `${field}.quantity must be at most ${MAX_QUANTITY_PER_LINE}, received ${quantity}`
        )
      );
      return;
    }

    const book = lookupBook(bookId);

    if (!book) {
      errors.push(
        fieldError(`${field}.bookId`, `Book not found: ${bookId}`)
      );
      return;
    }

    if (typeof book.price !== 'number' || !Number.isFinite(book.price) || book.price < 0) {
      // A catalogue problem, not a client one, but it must not become a
      // NaN total silently charged to somebody.
      errors.push(
        fieldError(`${field}.bookId`, `Book ${bookId} has no usable price`)
      );
      return;
    }

    const existing = seen.get(bookId);

    if (existing) {
      const merged = existing.quantity + quantity;

      if (merged > MAX_QUANTITY_PER_LINE) {
        errors.push(
          fieldError(
            `${field}.quantity`,
            `Total quantity for ${bookId} must be at most ${MAX_QUANTITY_PER_LINE}, received ${merged}`
          )
        );
        return;
      }

      existing.quantity = merged;
      return;
    }

    const entry = { bookId, quantity, book };
    seen.set(bookId, entry);
    normalised.push(entry);
  });

  if (errors.length > 0) {
    throw new CheckoutValidationError(errors);
  }

  return normalised;
}

function describe(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Number.isNaN(value)) return 'NaN';
  return `${typeof value} ${JSON.stringify(value)}`;
}

/**
 * Price a validated cart.
 *
 * Returns both the minor-unit integers (what the arithmetic ran on) and the
 * major-unit numbers (what goes on the order document and to Stripe), so a
 * caller never has to divide by 100 itself and get it subtly wrong.
 */
export function priceOrder(
  items,
  {
    taxRate = TAX_RATE,
    currency = getCurrencyConfig(),
    shipping = currency.defaultShipping,
    /*
     * A coupon discount, already decided, in minor units.
     *
     * It arrives as a number rather than as a coupon document because this
     * module prices carts and knows nothing about coupons — utils/coupon.js
     * decides *whether* and *how much*, and this decides where it lands in
     * the total. See #418.
     */
     discountMinor = 0,
  } = {}
) {
  const orderItems = [];
  const lineTotals = [];

  for (const { bookId, quantity, book } of items) {
    const unitMinor = toMinorUnits(book.price);
    const lineMinor = multiply(unitMinor, quantity);

    lineTotals.push(lineMinor);

    orderItems.push({
      bookId: book.id ?? bookId,
      title: book.title,
      price: toMajorUnits(unitMinor),
      quantity,
    });
  }

  const subtotalMinor = sum(lineTotals);

  /*
   * Clamped here as well as in utils/coupon.js. That is deliberate
   * belt-and-braces: this function is exported and a future caller could pass
   * a discount from somewhere that has not run the coupon rules. A discount
   * larger than the subtotal would otherwise make the goods free and start
   * eating into the tax and the shipping, and a negative one would be a
   * surcharge wearing a discount's name.
   */
  const appliedDiscountMinor = clampDiscount(discountMinor, subtotalMinor);

  /*
   * Tax is charged on what the customer actually pays for the goods, not on
   * the list price — so the discount comes off before the rate is applied.
   * Shipping is not discounted: a coupon is against the order's contents.
   */
  const discountedSubtotalMinor = subtotalMinor - appliedDiscountMinor;
  const taxMinor = applyRate(discountedSubtotalMinor, taxRate);
  const shippingMinor = toMinorUnits(shipping);
  const totalMinor = sum([discountedSubtotalMinor, taxMinor, shippingMinor]);

  return {
    orderItems,
    // Carried through so the caller never has to ask a second source what
    // currency these numbers are in. The order document records it and the
    // API response returns it, so the amount displayed and the amount
    // charged cannot drift apart again.
    currency: currency.code,
    minorUnits: {
      subtotal: subtotalMinor,
      discount: appliedDiscountMinor,
      tax: taxMinor,
      shipping: shippingMinor,
      total: totalMinor,
    },
    subtotal: toMajorUnits(subtotalMinor),
    /*
     * Always present, and zero when no coupon was used, so a caller never has
     * to distinguish "no discount" from "this response predates discounts".
     * The checkout summary renders the row from this rather than from what
     * the client computed for itself.
     */
    discount: toMajorUnits(appliedDiscountMinor),
    tax: toMajorUnits(taxMinor),
    shipping: toMajorUnits(shippingMinor),
    total: toMajorUnits(totalMinor),
  };
}

/**
 * A discount that is a whole number of minor units, at least nothing, and at
 * most the whole subtotal.
 *
 * A non-integer is rounded rather than refused: the callers all produce
 * integers, so reaching this with a fraction means a rounding slipped through
 * somewhere upstream, and turning that into a 500 in the middle of a checkout
 * is worse than absorbing it.
 */
function clampDiscount(discountMinor, subtotalMinor) {
  const value = Number(discountMinor);

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(Math.round(value), subtotalMinor);
}

/**
 * The reservation instruction for the repository: which books, how many, and
 * the version each was read at, so an interleaved checkout is caught.
 */
export function toReservation(items) {
  return items.map(({ bookId, quantity, book }) => ({
    bookId,
    quantity,
    expectedVersion: book.__v,
  }));
}

/**
 * Validate and price in one call — the whole decision a checkout has to make
 * before it touches inventory, Stripe or the database.
 */
export function prepareCheckout(rawItems, lookupBook, options) {
  const items = validateItems(rawItems, lookupBook);

  let pricing;
  try {
    pricing = priceOrder(items, options);
  } catch (error) {
    // The bounds in money.js are the last line of defence. Reaching one means
    // a request got past validateItems that should not have, so report it as
    // the client error it is rather than as a 500.
    if (error instanceof MoneyError) {
      throw new CheckoutValidationError([fieldError('items', error.message)]);
    }
    throw error;
  }

  return { items, reservation: toReservation(items), ...pricing };
}

export default {
  TAX_RATE,
  defaultShipping,
  MAX_LINE_ITEMS,
  MAX_QUANTITY_PER_LINE,
  CheckoutValidationError,
  validateItems,
  priceOrder,
  toReservation,
  prepareCheckout,
};
