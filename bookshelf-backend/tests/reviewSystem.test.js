import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import reviewRepository from '../repositories/reviewRepository.js';

/**
 * The review store, through the repository that owns it.
 *
 * This file used to import `createReview`, `voteHelpful` and `deleteReview`
 * from `controllers/reviewController.js`. The controller exports `markHelpful`
 * and has never had a `voteHelpful`, so the module failed to link and node:test
 * reported the whole file as one failure — its four tests had never executed
 * once.
 *
 * The names were not the only thing pointing elsewhere. Every call in it used
 * a shape the controller does not accept: the book id in `req.params.id` where
 * the controller reads `req.body.bookId`, the text in `body.comment` where the
 * validator says `body`, and assertions on `helpfulVotes` where the controller
 * responds with `helpfulCount`. All four of those are the *repository's*
 * vocabulary. The tests were written against the repository and imported from
 * the controller, so they are pointed at the repository here.
 *
 * Mongo is not connected under `node --test`, so these exercise the in-memory
 * fallback path — which is also the path a developer runs the app on without a
 * MONGODB_URI, so it is worth having covered on its own account.
 *
 * The book id is deliberately not one from the catalogue. `createReview` calls
 * `recalculateBookRating`, which calls `bookRepository.updateBook`, which
 * writes `data/books.json` to disk. An id the catalogue does not contain makes
 * that a no-op; a real one would have every run of `npm test` rewriting a
 * committed data file.
 */
const BOOK_ID = 'test-book-review-suite';
const OTHER_BOOK_ID = 'test-book-review-suite-2';

const ALICE = { _id: 'user_1', name: 'Alice Smith', email: 'alice@example.com' };
const BOB = { _id: 'user_2', name: 'Bob Jones', email: 'bob@example.com' };

/** A review payload in the shape the repository takes. */
function reviewFor(user, overrides = {}) {
  return {
    bookId: BOOK_ID,
    userId: user._id,
    userName: user.name,
    rating: 5,
    title: 'Outstanding Masterpiece',
    comment: 'This book completely transformed my understanding of architecture.',
    ...overrides,
  };
}

describe('review repository — creating reviews', () => {
  beforeEach(() => {
    reviewRepository.clearMemoryCache();
  });

  test('stores a review and reports it in the book stats', async () => {
    const created = await reviewRepository.createReview(reviewFor(ALICE));

    assert.equal(created.rating, 5);
    assert.equal(created.title, 'Outstanding Masterpiece');
    assert.equal(created.userName, 'Alice Smith');

    const stats = await reviewRepository.getReviewStats(BOOK_ID);
    assert.equal(stats.totalCount, 1);
    assert.equal(stats.averageRating, 5);
    assert.equal(stats.breakdown[5], 1);
  });

  test('coerces a numeric-string rating', async () => {
    const created = await reviewRepository.createReview(reviewFor(ALICE, { rating: '4' }));

    assert.strictEqual(created.rating, 4);
    const stats = await reviewRepository.getReviewStats(BOOK_ID);
    assert.strictEqual(stats.averageRating, 4);
  });

  test('starts a new review at zero helpful votes', async () => {
    const created = await reviewRepository.createReview(reviewFor(ALICE));
    assert.strictEqual(created.helpfulVotes, 0);
  });

  test('refuses a second review of the same book by the same user', async () => {
    await reviewRepository.createReview(reviewFor(ALICE));

    await assert.rejects(
      () => reviewRepository.createReview(reviewFor(ALICE, { rating: 4, title: 'Second' })),
      (error) => {
        assert.match(error.message, /already submitted a review/);
        assert.equal(error.status, 400);
        return true;
      }
    );

    const stats = await reviewRepository.getReviewStats(BOOK_ID);
    assert.equal(stats.totalCount, 1, 'the rejected review must not be stored');
  });

  test('lets a different user review the same book', async () => {
    await reviewRepository.createReview(reviewFor(ALICE, { rating: 5 }));
    await reviewRepository.createReview(reviewFor(BOB, { rating: 3 }));

    const stats = await reviewRepository.getReviewStats(BOOK_ID);
    assert.equal(stats.totalCount, 2);
    assert.equal(stats.averageRating, 4);
  });

  test('lets the same user review a different book', async () => {
    await reviewRepository.createReview(reviewFor(ALICE));
    await reviewRepository.createReview(reviewFor(ALICE, { bookId: OTHER_BOOK_ID, rating: 2 }));

    assert.equal((await reviewRepository.getReviewStats(BOOK_ID)).totalCount, 1);
    assert.equal((await reviewRepository.getReviewStats(OTHER_BOOK_ID)).totalCount, 1);
  });
});

describe('review repository — helpful votes', () => {
  beforeEach(() => {
    reviewRepository.clearMemoryCache();
  });

  test('increments the count on the review that was voted for', async () => {
    const created = await reviewRepository.createReview(reviewFor(ALICE));

    const updated = await reviewRepository.voteHelpful(created._id);

    assert.equal(updated.helpfulVotes, 1);
  });

  test('accumulates across votes', async () => {
    const created = await reviewRepository.createReview(reviewFor(ALICE));

    await reviewRepository.voteHelpful(created._id);
    await reviewRepository.voteHelpful(created._id);
    const updated = await reviewRepository.voteHelpful(created._id);

    assert.equal(updated.helpfulVotes, 3);
  });

  test('returns null for a review that does not exist', async () => {
    assert.equal(await reviewRepository.voteHelpful('rev_nope'), null);
  });

  test('leaves other reviews alone', async () => {
    const alice = await reviewRepository.createReview(reviewFor(ALICE));
    const bob = await reviewRepository.createReview(reviewFor(BOB));

    await reviewRepository.voteHelpful(alice._id);

    const { reviews } = await reviewRepository.getReviewsByBookId(BOOK_ID);
    const bobs = reviews.find((review) => String(review._id) === String(bob._id));
    assert.equal(bobs.helpfulVotes, 0);
  });
});

describe('review repository — deleting reviews', () => {
  beforeEach(() => {
    reviewRepository.clearMemoryCache();
  });

  test('lets the author delete their own review', async () => {
    const created = await reviewRepository.createReview(reviewFor(ALICE));

    assert.equal(await reviewRepository.deleteReview(created._id, ALICE._id), true);
    assert.equal((await reviewRepository.getReviewStats(BOOK_ID)).totalCount, 0);
  });

  test('refuses to let another user delete it', async () => {
    const created = await reviewRepository.createReview(reviewFor(ALICE));

    await assert.rejects(
      () => reviewRepository.deleteReview(created._id, BOB._id),
      (error) => {
        assert.match(error.message, /Not authorized/);
        assert.equal(error.status, 403);
        return true;
      }
    );

    assert.equal(
      (await reviewRepository.getReviewStats(BOOK_ID)).totalCount,
      1,
      'the review must survive an unauthorised delete'
    );
  });

  test('lets an admin delete somebody else’s review', async () => {
    const created = await reviewRepository.createReview(reviewFor(ALICE));

    assert.equal(await reviewRepository.deleteReview(created._id, BOB._id, true), true);
    assert.equal((await reviewRepository.getReviewStats(BOOK_ID)).totalCount, 0);
  });

  test('reports false for a review that does not exist', async () => {
    assert.equal(await reviewRepository.deleteReview('rev_nope', ALICE._id), false);
  });

  test('recomputes the average after a delete', async () => {
    await reviewRepository.createReview(reviewFor(ALICE, { rating: 5 }));
    const bobs = await reviewRepository.createReview(reviewFor(BOB, { rating: 1 }));

    assert.equal((await reviewRepository.getReviewStats(BOOK_ID)).averageRating, 3);

    await reviewRepository.deleteReview(bobs._id, BOB._id);

    const stats = await reviewRepository.getReviewStats(BOOK_ID);
    assert.equal(stats.averageRating, 5);
    assert.equal(stats.breakdown[1], 0);
  });
});

describe('review repository — reading a book’s reviews', () => {
  beforeEach(async () => {
    reviewRepository.clearMemoryCache();
  });

  /** Three reviews at 5, 3 and 1 stars, from three different users. */
  async function seed() {
    const five = await reviewRepository.createReview(
      reviewFor(ALICE, { rating: 5, title: 'Five' })
    );
    const three = await reviewRepository.createReview(
      reviewFor(BOB, { rating: 3, title: 'Three' })
    );
    const one = await reviewRepository.createReview(
      reviewFor({ _id: 'user_3', name: 'Cara' }, { rating: 1, title: 'One' })
    );
    return { five, three, one };
  }

  test('returns every review for the book, and none from another', async () => {
    await seed();
    await reviewRepository.createReview(reviewFor(ALICE, { bookId: OTHER_BOOK_ID }));

    const { reviews, total } = await reviewRepository.getReviewsByBookId(BOOK_ID);

    assert.equal(total, 3);
    assert.equal(reviews.length, 3);
    assert.ok(reviews.every((review) => review.bookId === BOOK_ID));
  });

  test('filters to a single star level', async () => {
    await seed();

    const { reviews, total } = await reviewRepository.getReviewsByBookId(BOOK_ID, { rating: 3 });

    assert.equal(total, 1);
    assert.equal(reviews[0].title, 'Three');
  });

  test('ignores a star filter outside 1–5', async () => {
    await seed();

    assert.equal((await reviewRepository.getReviewsByBookId(BOOK_ID, { rating: 9 })).total, 3);
    assert.equal((await reviewRepository.getReviewsByBookId(BOOK_ID, { rating: 0 })).total, 3);
  });

  test('sorts highest and lowest first on request', async () => {
    await seed();

    const highest = await reviewRepository.getReviewsByBookId(BOOK_ID, { sortBy: 'highest' });
    assert.deepEqual(
      highest.reviews.map((review) => review.rating),
      [5, 3, 1]
    );

    const lowest = await reviewRepository.getReviewsByBookId(BOOK_ID, { sortBy: 'lowest' });
    assert.deepEqual(
      lowest.reviews.map((review) => review.rating),
      [1, 3, 5]
    );
  });

  test('sorts by helpful votes on request', async () => {
    const { one } = await seed();
    await reviewRepository.voteHelpful(one._id);
    await reviewRepository.voteHelpful(one._id);

    const { reviews } = await reviewRepository.getReviewsByBookId(BOOK_ID, { sortBy: 'helpful' });

    assert.equal(reviews[0].title, 'One');
    assert.equal(reviews[0].helpfulVotes, 2);
  });

  test('paginates, and reports how many pages there are', async () => {
    await seed();

    const first = await reviewRepository.getReviewsByBookId(BOOK_ID, { page: 1, limit: 2 });
    assert.equal(first.reviews.length, 2);
    assert.equal(first.total, 3);
    assert.equal(first.pages, 2);
    assert.equal(first.page, 1);

    const second = await reviewRepository.getReviewsByBookId(BOOK_ID, { page: 2, limit: 2 });
    assert.equal(second.reviews.length, 1);
  });

  test('reports one page, not zero, for a book with no reviews', async () => {
    const { reviews, total, pages } = await reviewRepository.getReviewsByBookId(BOOK_ID);

    assert.deepEqual(reviews, []);
    assert.equal(total, 0);
    assert.equal(pages, 1);
  });

  test('carries the stats alongside the page', async () => {
    await seed();

    const { stats } = await reviewRepository.getReviewsByBookId(BOOK_ID);

    assert.equal(stats.totalCount, 3);
    assert.equal(stats.averageRating, 3);
    assert.equal(stats.breakdown[5], 1);
    assert.equal(stats.breakdown[3], 1);
    assert.equal(stats.breakdown[1], 1);
    assert.equal(stats.breakdown[4], 0);
  });
});

describe('review repository — stats for a book with nothing on it', () => {
  beforeEach(() => {
    reviewRepository.clearMemoryCache();
  });

  test('is zero rather than NaN', async () => {
    const stats = await reviewRepository.getReviewStats('a-book-nobody-reviewed');

    assert.strictEqual(stats.averageRating, 0);
    assert.strictEqual(stats.totalCount, 0);
    assert.deepEqual(stats.breakdown, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  test('rounds the average to one decimal place', async () => {
    // 5 + 4 + 4 = 13/3 = 4.333…
    await reviewRepository.createReview(reviewFor(ALICE, { rating: 5 }));
    await reviewRepository.createReview(reviewFor(BOB, { rating: 4 }));
    await reviewRepository.createReview(reviewFor({ _id: 'user_3', name: 'Cara' }, { rating: 4 }));

    assert.strictEqual((await reviewRepository.getReviewStats(BOOK_ID)).averageRating, 4.3);
  });
});
