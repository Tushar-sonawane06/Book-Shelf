import {
  required,
  isString,
  maxLength,
  trim,
  isNumber,
  minNumber,
} from '../utils/validators.js';
import { SHELVES } from '../models/ReadingList.js';

export const addBookSchema = {
  bookId: {
    normalise: trim,
    rules: [required('bookId'), isString('bookId'), maxLength('bookId', 100)],
  },
  shelf: {
    normalise: trim,
    rules: [
      isString('shelf'),
      (val) => {
        if (typeof val === 'string' && val !== '' && !SHELVES.includes(val)) {
          return `shelf must be one of: ${SHELVES.join(', ')}`;
        }
        return null;
      },
    ],
  },
  notes: {
    normalise: trim,
    rules: [isString('notes'), maxLength('notes', 2000)],
  },
  rating: {
    rules: [
      isNumber('rating'),
      minNumber('rating', 1),
      (val) => (typeof val === 'number' && val > 5 ? 'rating must be at most 5' : null),
    ],
  },
};

export const updateBookSchema = {
  shelf: {
    normalise: trim,
    rules: [
      isString('shelf'),
      (val) => {
        if (typeof val === 'string' && val !== '' && !SHELVES.includes(val)) {
          return `shelf must be one of: ${SHELVES.join(', ')}`;
        }
        return null;
      },
    ],
  },
  notes: {
    normalise: trim,
    rules: [isString('notes'), maxLength('notes', 2000)],
  },
  rating: {
    rules: [
      isNumber('rating'),
      minNumber('rating', 1),
      (val) => (typeof val === 'number' && val > 5 ? 'rating must be at most 5' : null),
    ],
  },
  progress: {
    rules: [
      isNumber('progress'),
      minNumber('progress', 0),
      (val) => (typeof val === 'number' && val > 100 ? 'progress must be at most 100' : null),
    ],
  },
};
