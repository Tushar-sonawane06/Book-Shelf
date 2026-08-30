import {
  required,
  isString,
  maxLength,
  trim,
  isNumber,
  minNumber,
} from '../utils/validators.js';

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
      (val) =>
        typeof val === 'number' && val !== Math.floor(val)
          ? 'rating must be a whole number'
          : null,
    ],
  },
  title: {
    normalise: trim,
    rules: [isString('title'), maxLength('title', 150)],
  },
  body: {
    normalise: trim,
    rules: [isString('body'), maxLength('body', 5000)],
  },
};

export const updateReviewSchema = {
  rating: {
    rules: [
      isNumber('rating'),
      minNumber('rating', 1),
      (val) => (typeof val === 'number' && val > 5 ? 'rating must be at most 5' : null),
      (val) =>
        typeof val === 'number' && val !== Math.floor(val)
          ? 'rating must be a whole number'
          : null,
    ],
  },
  title: {
    normalise: trim,
    rules: [isString('title'), maxLength('title', 150)],
  },
  body: {
    normalise: trim,
    rules: [isString('body'), maxLength('body', 5000)],
  },
};
