import {
  required,
  isString,
  maxLength,
  trim,
  isNumber,
  minNumber,
} from '../utils/validators.js';

export const createAlertSchema = {
  bookId: {
    normalise: trim,
    rules: [required('bookId'), isString('bookId'), maxLength('bookId', 100)],
  },
  targetPrice: {
    rules: [
      required('targetPrice'),
      isNumber('targetPrice'),
      minNumber('targetPrice', 0),
    ],
  },
};
