import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import * as reviewController from '../controllers/reviewController.js';
import {
  createReviewSchema,
  updateReviewSchema,
} from '../validators/reviewValidators.js';

/**
 * Unit tests for the review controller logic.
 *
 * These tests exercise the rating-aggregation helper and the breakdown
 * computation without spinning up an HTTP server.  Run with:
 *
 *   node --test tests/reviewController.test.js
 */

// ── Helpers extracted for testing ──────────────────────────────────────────

/**
 * Recalculate the star distribution from an array of review objects.
 * Kept in sync with the aggregation in reviewController.js so it can be
 * tested independently.
 */
function computeBreakdown(reviews) {
  const counts = [0, 0, 0, 0, 0]; // index 0 → 1 star, … index 4 → 5 stars

  for (const r of reviews) {
    if (r.hidden) continue;
    const idx = Math.round(r.rating) - 1;
    if (idx >= 0 && idx < 5) {
      counts[idx] += 1;
    }
  }

  return [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: counts[star - 1],
  }));
}

function computeAverage(reviews) {
  const visible = reviews.filter((r) => !r.hidden);
  if (visible.length === 0) return 0;
  const sum = visible.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / visible.length) * 10) / 10;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('reviewController helpers', () => {
  const sampleReviews = [
    { rating: 5, hidden: false },
    { rating: 4, hidden: false },
    { rating: 5, hidden: false },
    { rating: 3, hidden: false },
    { rating: 1, hidden: false },
  ];

  describe('computeBreakdown', () => {
    it('returns correct counts for a mix of ratings', () => {
      const result = computeBreakdown(sampleReviews);
      assert.deepStrictEqual(result, [
        { star: 5, count: 2 },
        { star: 4, count: 1 },
        { star: 3, count: 1 },
        { star: 2, count: 0 },
        { star: 1, count: 1 },
      ]);
    });

    it('returns zero counts when the review list is empty', () => {
      const result = computeBreakdown([]);
      for (const entry of result) {
        assert.strictEqual(entry.count, 0);
      }
    });

    it('ignores hidden reviews', () => {
      const reviews = [
        { rating: 5, hidden: false },
        { rating: 5, hidden: true },
        { rating: 5, hidden: true },
      ];
      const result = computeBreakdown(reviews);
      const fiveStar = result.find((b) => b.star === 5);
      assert.strictEqual(fiveStar.count, 1);
    });

    it('clamps out-of-range ratings without crashing', () => {
      const reviews = [
        { rating: 0, hidden: false },
        { rating: 6, hidden: false },
        { rating: 3, hidden: false },
      ];
      // 0 maps to index -1 (skipped), 6 maps to index 5 (skipped)
      const result = computeBreakdown(reviews);
      const threeStar = result.find((b) => b.star === 3);
      assert.strictEqual(threeStar.count, 1);
    });
  });

  describe('computeAverage', () => {
    it('computes the arithmetic mean rounded to one decimal', () => {
      const avg = computeAverage(sampleReviews);
      // (5+4+5+3+1) / 5 = 3.6
      assert.strictEqual(avg, 3.6);
    });

    it('returns 0 for an empty list', () => {
      assert.strictEqual(computeAverage([]), 0);
    });

    it('excludes hidden reviews from the average', () => {
      const reviews = [
        { rating: 5, hidden: false },
        { rating: 1, hidden: true },
      ];
      assert.strictEqual(computeAverage(reviews), 5);
    });
  });
});

/*
 * These used to sit behind `const schemas = await import(…)` inside this
 * describe callback, which is not async — so the file was a SyntaxError and
 * node:test never ran a line of it, including the two suites above. The
 * validators are plain objects with no side effects, which is the argument
 * the old comment made for the dynamic import and is in fact the reason a
 * static one at the top of the file is fine.
 */
describe('review validators (schema shape)', () => {
  it('createReviewSchema has all required fields', () => {
    assert.ok(createReviewSchema.bookId, 'bookId is missing');
    assert.ok(createReviewSchema.rating, 'rating is missing');
    assert.ok(createReviewSchema.title, 'title is missing');
    assert.ok(createReviewSchema.body, 'body is missing');
  });

  it('each field has at least one rule', () => {
    for (const [field, config] of Object.entries(createReviewSchema)) {
      assert.ok(
        Array.isArray(config.rules) && config.rules.length > 0,
        `${field} has no rules`
      );
    }
  });

  it('updateReviewSchema carries the editable fields', () => {
    assert.ok(updateReviewSchema.rating, 'rating is missing');
    assert.ok(updateReviewSchema.title, 'title is missing');
    assert.ok(updateReviewSchema.body, 'body is missing');
  });

  it('the schema names the request body field `body`, not `comment`', () => {
    // reviewSystem.test.js was written against `comment` and never ran, so
    // nothing noticed the two disagreed.
    assert.ok(createReviewSchema.body);
    assert.equal(createReviewSchema.comment, undefined);
  });
});

/*
 * The export surface.
 *
 * `routes/reviewRoutes.js` and `routes/standaloneReviewRoutes.js` both import
 * named functions from this controller. When one of those names is wrong the
 * failure is a module-link error at import time — the route file cannot load,
 * and if it is mounted the server does not start. That is what
 * `standaloneReviewRoutes.js` was doing with `voteHelpful`.
 */
describe('the controller exports what the routes import', () => {
  const expected = [
    'getBookReviews',
    'getReviewBreakdown',
    'createReview',
    'updateReview',
    'deleteReview',
    'markHelpful',
    'getMyReview',
  ];

  for (const name of expected) {
    it(`exports ${name}`, () => {
      assert.equal(
        typeof reviewController[name],
        'function',
        `${name} is not exported from reviewController.js`
      );
    });
  }

  it('does not export voteHelpful — that name belongs to the repository', () => {
    assert.equal(reviewController.voteHelpful, undefined);
  });
});
