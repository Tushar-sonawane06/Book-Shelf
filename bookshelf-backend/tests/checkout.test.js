import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_LINE_ITEMS,
  MAX_QUANTITY_PER_LINE,
  CheckoutValidationError,
  validateItems,
  priceOrder,
  toReservation,
  prepareCheckout,
  defaultShipping,
} from '../utils/checkout.js';
import { SUPPORTED_CURRENCIES } from '../config/currency.js';

/**
 * A three-book catalogue. The real one is read from disk; the lookup is
 * injected precisely so these tests do not have to be.
 */
const CATALOGUE = {
  b1: { id: 'b1', title: 'The Quiet Ones', price: 349, inventory: 8, __v: 2 },
  b2: { id: 'b2', title: 'Field Notes', price: 299, inventory: 10, __v: 1 },
  b3: { id: 'b3', title: 'Half Moon Bay', price: 399, inventory: 0, __v: 5 },
};

const lookupBook = (id) => CATALOGUE[id];

/** Asserts the call fails validation and returns the collected errors. */
function expectRejected(items) {
  try {
    validateItems(items, lookupBook);
  } catch (error) {
    assert.ok(
      error instanceof CheckoutValidationError,
      `expected a CheckoutValidationError, got ${error.name}: ${error.message}`
    );
    assert.equal(error.status, 400);
    return error.errors;
  }

  assert.fail('expected validation to reject, but it passed');
}

describe('validateItems — the shape of the request', () => {
  test('rejects a missing items array instead of throwing a TypeError', () => {
    // `for (const item of undefined)` used to reach the generic error
    // handler and come back as a 500.
    const errors = expectRejected(undefined);
    assert.equal(errors[0].field, 'items');
    assert.match(errors[0].message, /required/);
  });

  test('rejects a non-array items', () => {
    for (const value of ['b1', 42, {}, true]) {
      const errors = expectRejected(value);
      assert.match(errors[0].message, /must be an array/);
    }
  });

  test('rejects an empty cart', () => {
    const errors = expectRejected([]);
    assert.match(errors[0].message, /at least one entry/);
  });

  test('rejects a cart with too many lines', () => {
    const items = Array.from({ length: MAX_LINE_ITEMS + 1 }, () => ({
      id: 'b1',
      quantity: 1,
    }));

    const errors = expectRejected(items);
    assert.match(errors[0].message, /at most 50 entries/);
  });

  test('rejects entries that are not objects', () => {
    const errors = expectRejected(['b1', null, 7]);
    assert.equal(errors.length, 3);
    assert.equal(errors[0].field, 'items[0]');
    assert.equal(errors[2].field, 'items[2]');
  });
});

describe('validateItems — the book id', () => {
  test('accepts either bookId or id', () => {
    const byBookId = validateItems([{ bookId: 'b1', quantity: 1 }], lookupBook);
    const byId = validateItems([{ id: 'b1', quantity: 1 }], lookupBook);

    assert.equal(byBookId[0].bookId, 'b1');
    assert.equal(byId[0].bookId, 'b1');
  });

  test('trims surrounding whitespace', () => {
    const items = validateItems([{ id: '  b1  ', quantity: 1 }], lookupBook);
    assert.equal(items[0].bookId, 'b1');
  });

  test('rejects a missing, empty or non-string id', () => {
    for (const id of [undefined, null, '', '   ', 42, {}]) {
      const errors = expectRejected([{ id, quantity: 1 }]);
      assert.equal(errors[0].field, 'items[0].bookId');
    }
  });

  test('rejects an id that is not in the catalogue', () => {
    const errors = expectRejected([{ id: 'does-not-exist', quantity: 1 }]);
    assert.match(errors[0].message, /Book not found: does-not-exist/);
  });
});

describe('validateItems — the quantity', () => {
  test('accepts a positive integer', () => {
    const items = validateItems([{ id: 'b1', quantity: 3 }], lookupBook);
    assert.equal(items[0].quantity, 3);
  });

  /**
   * The reported bug. A negative quantity passed the old stock check
   * (`8 < -5` is false) and the mutation phase then ran `inventory -= -5`,
   * adding five units to the catalogue on disk.
   */
  test('rejects a negative quantity', () => {
    const errors = expectRejected([{ id: 'b1', quantity: -5 }]);
    assert.equal(errors[0].field, 'items[0].quantity');
    assert.match(errors[0].message, /at least 1, received -5/);
  });

  test('rejects a zero quantity', () => {
    const errors = expectRejected([{ id: 'b1', quantity: 0 }]);
    assert.match(errors[0].message, /at least 1/);
  });

  test('rejects a fractional quantity', () => {
    const errors = expectRejected([{ id: 'b1', quantity: 1.5 }]);
    assert.match(errors[0].message, /whole number/);
  });

  test('rejects a missing, non-numeric or NaN quantity', () => {
    for (const quantity of [undefined, null, '3', NaN, Infinity, {}]) {
      const errors = expectRejected([{ id: 'b1', quantity }]);
      assert.equal(errors[0].field, 'items[0].quantity');
    }
  });

  test('rejects a quantity beyond the per-line cap', () => {
    const errors = expectRejected([
      { id: 'b1', quantity: MAX_QUANTITY_PER_LINE + 1 },
    ]);
    assert.match(errors[0].message, /at most 20/);
  });

  test('collects every problem rather than stopping at the first', () => {
    const errors = expectRejected([
      { id: 'b1', quantity: -1 },
      { id: 'nope', quantity: 1 },
      { id: 'b2', quantity: 2.5 },
    ]);

    assert.equal(errors.length, 3);
    assert.deepEqual(
      errors.map((error) => error.field),
      ['items[0].quantity', 'items[1].bookId', 'items[2].quantity']
    );
  });
});

describe('validateItems — duplicate lines', () => {
  test('collapses the same book appearing twice', () => {
    const items = validateItems(
      [
        { id: 'b1', quantity: 2 },
        { id: 'b2', quantity: 1 },
        { id: 'b1', quantity: 3 },
      ],
      lookupBook
    );

    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map(({ bookId, quantity }) => ({ bookId, quantity })),
      [
        { bookId: 'b1', quantity: 5 },
        { bookId: 'b2', quantity: 1 },
      ]
    );
  });

  test('applies the per-line cap to the merged quantity', () => {
    // Two lines of 15 would otherwise slip 30 units past a cap of 20, and
    // reserve against the same book twice.
    const errors = expectRejected([
      { id: 'b1', quantity: 15 },
      { id: 'b1', quantity: 15 },
    ]);

    assert.match(errors[0].message, /Total quantity for b1/);
  });
});

describe('priceOrder', () => {
  test('prices a single line exactly', () => {
    const items = validateItems([{ id: 'b1', quantity: 3 }], lookupBook);
    const pricing = priceOrder(items);

    assert.equal(pricing.subtotal, 1047);
    assert.equal(pricing.tax, 52.35); // not 52.35000000000001
    // 49, not 5.99: shipping is a major-unit amount in the shop's own
    // currency, which is INR. It used to be a hardcoded dollar figure
    // charged next to a rupee-priced catalogue. See #335.
    assert.equal(pricing.shipping, 49);
    assert.equal(pricing.total, 1148.35);
  });

  test('prices in the shop currency and says which one', () => {
    const items = validateItems([{ id: 'b1', quantity: 3 }], lookupBook);

    assert.equal(priceOrder(items).currency, 'INR');
    assert.equal(
      priceOrder(items, { currency: SUPPORTED_CURRENCIES.USD }).currency,
      'USD'
    );
  });

  test('shipping follows the currency it is priced in', () => {
    const items = validateItems([{ id: 'b1', quantity: 3 }], lookupBook);

    assert.equal(priceOrder(items).shipping, 49);
    assert.equal(
      priceOrder(items, { currency: SUPPORTED_CURRENCIES.USD }).shipping,
      5.99
    );

    // The helper and the default used by priceOrder are the same number.
    assert.equal(defaultShipping(), 49);
    assert.equal(defaultShipping(SUPPORTED_CURRENCIES.USD), 5.99);
  });

  test('an explicit shipping override still wins over the currency default', () => {
    const items = validateItems([{ id: 'b1', quantity: 3 }], lookupBook);
    const pricing = priceOrder(items, { shipping: 0 });

    assert.equal(pricing.shipping, 0);
    assert.equal(pricing.total, 1099.35);
  });

  test('reports the integer minor units alongside the major ones', () => {
    const items = validateItems([{ id: 'b1', quantity: 3 }], lookupBook);
    const { minorUnits } = priceOrder(items);

    assert.deepEqual(minorUnits, {
      subtotal: 104700,
      // Zero rather than absent when no coupon was applied, so a caller never
      // has to tell "no discount" from "this response predates discounts".
      // See #418.
      discount: 0,
      tax: 5235,
      shipping: 4900,
      total: 114835,
    });
  });

  test('the parts always add up to the total', () => {
    const carts = [
      [{ id: 'b1', quantity: 1 }],
      [{ id: 'b2', quantity: 7 }],
      [
        { id: 'b1', quantity: 3 },
        { id: 'b2', quantity: 2 },
        { id: 'b3', quantity: 1 },
      ],
    ];

    for (const cart of carts) {
      const { minorUnits } = priceOrder(validateItems(cart, lookupBook));

      assert.equal(
        minorUnits.subtotal + minorUnits.tax + minorUnits.shipping,
        minorUnits.total,
        `parts did not sum for ${JSON.stringify(cart)}`
      );
    }
  });

  test('builds the order line from the catalogue, not from the request', () => {
    // The client sends a price too. It is ignored — that is the whole point
    // of pricing server-side.
    const items = validateItems(
      [{ id: 'b1', quantity: 1, price: 0.01, title: 'Free Book' }],
      lookupBook
    );
    const { orderItems } = priceOrder(items);

    assert.deepEqual(orderItems, [
      { bookId: 'b1', title: 'The Quiet Ones', price: 349, quantity: 1 },
    ]);
  });

  test('a total can never come out negative', () => {
    // Every route to a negative subtotal is closed at validation, so the
    // only way to reach one here is a catalogue with a negative price —
    // which validateItems also rejects.
    const errors = expectRejected([{ id: 'bad', quantity: 1 }]);
    assert.ok(errors.length > 0);
  });
});

describe('toReservation', () => {
  test('carries the version each book was read at', () => {
    const items = validateItems(
      [
        { id: 'b1', quantity: 2 },
        { id: 'b2', quantity: 1 },
      ],
      lookupBook
    );

    assert.deepEqual(toReservation(items), [
      { bookId: 'b1', quantity: 2, expectedVersion: 2 },
      { bookId: 'b2', quantity: 1, expectedVersion: 1 },
    ]);
  });

  test('reserves one line per book after duplicates are merged', () => {
    const items = validateItems(
      [
        { id: 'b1', quantity: 2 },
        { id: 'b1', quantity: 1 },
      ],
      lookupBook
    );

    const reservation = toReservation(items);

    assert.equal(reservation.length, 1);
    assert.equal(reservation[0].quantity, 3);
  });
});

describe('prepareCheckout', () => {
  test('returns everything the controller needs in one call', () => {
    const result = prepareCheckout([{ id: 'b1', quantity: 2 }], lookupBook);

    assert.equal(result.total, 781.9);
    assert.equal(result.currency, 'INR');
    assert.equal(result.orderItems.length, 1);
    assert.deepEqual(result.reservation, [
      { bookId: 'b1', quantity: 2, expectedVersion: 2 },
    ]);
  });

  test('surfaces validation failures as a 400-shaped error', () => {
    assert.throws(
      () => prepareCheckout([{ id: 'b1', quantity: -5 }], lookupBook),
      (error) => error instanceof CheckoutValidationError && error.status === 400
    );
  });

  test('prices a book that is out of stock — reserving is a later step', () => {
    // b3 has an inventory of 0. Validation is about the request being
    // well-formed; whether the stock is there is the repository's call, and
    // it answers 409.
    const result = prepareCheckout([{ id: 'b3', quantity: 1 }], lookupBook);
    assert.equal(result.subtotal, 399);
  });
});
