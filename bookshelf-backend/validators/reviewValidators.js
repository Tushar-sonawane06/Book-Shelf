import {
  required,
  isString,
  maxLength,
  trim,
  isNumber,
  minNumber,
} from '../utils/validators.js';

/**
 * Validation schemas for the reviews API.
 *
 * Uses the same field-spec convention as bookValidators.js: each field has
 * an optional `normalise` function and an array of `rules`. The `validateBody`
 * middleware runs these before the controller sees the request.
 */
export const createReviewSchema = {
  bookId: {
    normalise: trim,
    rules: [required('bookId'), isString('bookId'), maxLength('bookId', 100)],
  },
  rating: {
    rules: [
      required('rating'),
      isNumber('rating'),
      minNumber('rating', 1),
      (val) => (typeof val === 'number' && val > 5 ? 'rating must be at most 5' : null),
    ],
  },
  title: {
    normalise: trim,
    rules: [isString('title'), maxLength('title', 150)],
  },
  body: {
    normalise: trim,
    rules: [isString('body'), maxLength('body', 2000)],
  },
};

/**
 * When editing a review the user may only change the rating, title, and body.
 * The bookId stays the same — the route already has the review id.
 */
export const updateReviewSchema = {
  rating: {
    rules: [
      isNumber('rating'),
      minNumber('rating', 1),
      (val) => (typeof val === 'number' && val > 5 ? 'rating must be at most 5' : null),
    ],
  },
  title: {
    normalise: trim,
    rules: [isString('title'), maxLength('title', 150)],
  },
  body: {
    normalise: trim,
    rules: [isString('body'), maxLength('body', 2000)],
  },
};
