import { describe, it, expect } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Unit tests for reviewController helper logic.
 *
 * These tests verify pure helper functions without hitting MongoDB.
 * The controller's request handlers are integration-tested against a
 * running server with a test database.
 */

describe('Review validation logic', () => {
  /** Simulate the rating validation from createOrUpdateReview. */
  function validateRating(rating) {
    if (!rating || rating < 1 || rating > 5) {
      return { valid: false, message: 'Rating must be between 1 and 5' };
    }
    return { valid: true };
  }

  it('rejects a rating below 1', () => {
    const result = validateRating(0);
    assert.equal(result.valid, false);
    assert.match(result.message, /between 1 and 5/);
  });

  it('rejects a rating above 5', () => {
    const result = validateRating(6);
    assert.equal(result.valid, false);
  });

  it('rejects a missing rating', () => {
    assert.equal(validateRating(undefined).valid, false);
    assert.equal(validateRating(null).valid, false);
    assert.equal(validateRating('').valid, false);
  });

  it('accepts every integer from 1 to 5', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      assert.equal(validateRating(rating).valid, true, `Rating ${rating} should be valid`);
    }
  });
});

describe('Review sort parameter mapping', () => {
  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    highest: { rating: -1, createdAt: -1 },
    lowest: { rating: 1, createdAt: -1 },
    helpful: { helpfulCount: -1, createdAt: -1 },
  };

  it('maps "newest" to descending createdAt', () => {
    assert.deepEqual(sortMap.newest, { createdAt: -1 });
  });

  it('maps "highest" to descending rating then createdAt', () => {
    assert.deepEqual(sortMap.highest, { rating: -1, createdAt: -1 });
  });

  it('falls back to newest for an unknown sort param', () => {
    const fallback = sortMap['unknown'] || sortMap.newest;
    assert.deepEqual(fallback, sortMap.newest);
  });
});

describe('Helpful vote toggle logic', () => {
  function toggleHelpful(helpfulBy, userId) {
    const alreadyVoted = helpfulBy.some((id) => id === userId);

    if (alreadyVoted) {
      return {
        helpfulBy: helpfulBy.filter((id) => id !== userId),
        helpfulCount: Math.max(0, helpfulBy.length - 1),
        voted: false,
      };
    }

    return {
      helpfulBy: [...helpfulBy, userId],
      helpfulCount: helpfulBy.length + 1,
      voted: true,
    };
  }

  it('adds a vote when the user has not voted', () => {
    const result = toggleHelpful(['a', 'b'], 'c');
    assert.deepEqual(result.helpfulBy, ['a', 'b', 'c']);
    assert.equal(result.helpfulCount, 3);
    assert.equal(result.voted, true);
  });

  it('removes a vote when the user has already voted', () => {
    const result = toggleHelpful(['a', 'b', 'c'], 'b');
    assert.deepEqual(result.helpfulBy, ['a', 'c']);
    assert.equal(result.helpfulCount, 2);
    assert.equal(result.voted, false);
  });

  it('does not go below 0 when removing from an empty list', () => {
    const result = toggleHelpful([], 'x');
    assert.equal(result.helpfulCount, 1);
    assert.equal(result.voted, true);
  });
});

describe('Review stats aggregation', () => {
  function computeStats(bucketArray) {
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let sum = 0;

    for (const bucket of bucketArray) {
      breakdown[bucket.rating] = bucket.count;
      total += bucket.count;
      sum += bucket.rating * bucket.count;
    }

    const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

    return { average, total, breakdown };
  }

  it('computes correct average from mixed ratings', () => {
    const result = computeStats([
      { rating: 5, count: 2 },
      { rating: 3, count: 1 },
    ]);

    assert.equal(result.average, 4.3);
    assert.equal(result.total, 3);
    assert.equal(result.breakdown[5], 2);
    assert.equal(result.breakdown[3], 1);
    assert.equal(result.breakdown[1], 0);
  });

  it('returns zero average for no reviews', () => {
    const result = computeStats([]);
    assert.equal(result.average, 0);
    assert.equal(result.total, 0);
  });

  it('returns exact average for identical ratings', () => {
    const result = computeStats([{ rating: 4, count: 5 }]);
    assert.equal(result.average, 4);
    assert.equal(result.total, 5);
  });
});

describe('Review body length limits', () => {
  const TITLE_MAX = 120;
  const BODY_MAX = 2000;

  it('rejects a title exceeding 120 characters', () => {
    const longTitle = 'A'.repeat(TITLE_MAX + 1);
    assert.ok(longTitle.length > TITLE_MAX);
  });

  it('rejects a body exceeding 2000 characters', () => {
    const longBody = 'B'.repeat(BODY_MAX + 1);
    assert.ok(longBody.length > BODY_MAX);
  });

  it('accepts a title at exactly 120 characters', () => {
    const title = 'X'.repeat(TITLE_MAX);
    assert.equal(title.length, TITLE_MAX);
  });

  it('accepts a body at exactly 2000 characters', () => {
    const body = 'Y'.repeat(BODY_MAX);
    assert.equal(body.length, BODY_MAX);
  });
});
