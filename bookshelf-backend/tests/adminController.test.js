import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { dateFilter } from '../controllers/adminController.js';
import adminRouter from '../routes/adminRoutes.js';

/**
 * Admin controller helpers, and the money the dashboard renders.
 *
 * This file used to define its own `dateFilter` and its own `formatCurrency`
 * at the top and assert against those, under a comment reading
 * "Re-implementation of the dateFilter helper from adminController.js. Kept in
 * sync for independent testing."
 *
 * Nothing enforced the sync, so `dateFilter` in the controller — the thing
 * deciding the range behind every /api/admin/analytics query — could have been
 * changed to anything and these tests would still have passed. It is imported
 * now.
 *
 * The `formatCurrency` block is gone rather than fixed. There is no
 * formatCurrency in this package; the function it was copying is the one on
 * the admin dashboard in the frontend, which is where the rupee grouping was
 * actually wrong and where it is now fixed and tested. A backend test cannot
 * assert anything true about a frontend helper, and asserting it against a
 * local copy is how the wrong grouping survived. Money that the backend does
 * format — for logs and error messages — is `formatAmount` in
 * `config/currency.js`, covered by `tests/currency.test.js`.
 *
 *   node --test tests/adminController.test.js
 */

describe('dateFilter', () => {
  it('returns empty object for undefined period', () => {
    assert.deepStrictEqual(dateFilter(undefined), {});
  });

  it('returns empty object for "all"', () => {
    assert.deepStrictEqual(dateFilter('all'), {});
  });

  it('returns empty object for unknown period', () => {
    assert.deepStrictEqual(dateFilter('xyz'), {});
  });

  it('returns empty object for an empty string', () => {
    assert.deepStrictEqual(dateFilter(''), {});
  });

  it('returns a valid date filter for "7d"', () => {
    const result = dateFilter('7d');
    assert.ok(result.createdAt);
    assert.ok(result.createdAt.$gte instanceof Date);
    // The date should be within the last 8 days (to account for timing).
    const diff = Date.now() - result.createdAt.$gte.getTime();
    assert.ok(diff <= 8 * 24 * 60 * 60 * 1000);
    assert.ok(diff >= 6 * 24 * 60 * 60 * 1000);
  });

  it('returns a valid date filter for "30d"', () => {
    const result = dateFilter('30d');
    const diff = Date.now() - result.createdAt.$gte.getTime();
    assert.ok(diff <= 31 * 24 * 60 * 60 * 1000);
    assert.ok(diff >= 29 * 24 * 60 * 60 * 1000);
  });

  it('returns a valid date filter for "90d"', () => {
    const result = dateFilter('90d');
    const diff = Date.now() - result.createdAt.$gte.getTime();
    assert.ok(diff <= 91 * 24 * 60 * 60 * 1000);
    assert.ok(diff >= 89 * 24 * 60 * 60 * 1000);
  });

  it('returns a valid date filter for "1y"', () => {
    const result = dateFilter('1y');
    const diff = Date.now() - result.createdAt.$gte.getTime();
    assert.ok(diff <= 366 * 24 * 60 * 60 * 1000);
    assert.ok(diff >= 364 * 24 * 60 * 60 * 1000);
  });

  it('names a field Mongo can match on', () => {
    // The shape is spread straight into an aggregation $match, so the key has
    // to be the document field and the value a comparison operator.
    assert.deepStrictEqual(Object.keys(dateFilter('7d')), ['createdAt']);
    assert.deepStrictEqual(Object.keys(dateFilter('7d').createdAt), ['$gte']);
  });

  it('gives a fresh Date each call, not a shared one', () => {
    const first = dateFilter('7d').createdAt.$gte;
    const second = dateFilter('7d').createdAt.$gte;
    assert.notStrictEqual(first, second);
  });
});

describe('admin routes', () => {
  const endpoints = [
    '/stats',
    '/sales-trend',
    '/monthly-revenue',
    '/top-books',
    '/recent-orders',
    '/order-statuses',
    '/user-growth',
    '/review-stats',
  ];

  /*
   * This used to loop over a list of bare strings asserting each was a
   * non-empty string — true of any list of strings, and unrelated to the
   * router. It reads the router's own stack now, so removing or renaming a
   * route fails the test.
   */
  const registered = adminRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);

  for (const endpoint of endpoints) {
    it(`registers GET ${endpoint}`, () => {
      assert.ok(
        registered.includes(endpoint),
        `${endpoint} is not registered on adminRouter`
      );
    });
  }

  it('registers no routes beyond the eight documented ones', () => {
    assert.deepStrictEqual(registered.sort(), [...endpoints].sort());
  });

  it('guards every route behind auth before any handler runs', () => {
    // router.use(protect, admin) — two middleware layers with no route,
    // registered ahead of the endpoints.
    const middleware = adminRouter.stack.filter((layer) => !layer.route);
    assert.ok(middleware.length >= 2, 'protect and admin are not both mounted');
  });
});
