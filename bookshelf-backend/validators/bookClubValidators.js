import {
  required,
  isString,
  maxLength,
  trim,
  isNumber,
  minNumber,
} from '../utils/validators.js';

/**
 * Validation schemas for Book Club endpoints.
 *
 * Follows the same field-spec pattern used by readingListValidators.
 */

export const createClubSchema = {
  name: {
    normalise: trim,
    rules: [required('name'), isString('name'), maxLength('name', 100)],
  },
  description: {
    normalise: trim,
    rules: [isString('description'), maxLength('description', 2000)],
  },
  genre: {
    normalise: trim,
    rules: [isString('genre'), maxLength('genre', 60)],
  },
  maxMembers: {
    rules: [isNumber('maxMembers'), minNumber('maxMembers', 0)],
  },
  isPublic: {
    rules: [],
  },
  tags: {
    rules: [],
  },
};

export const updateClubSchema = {
  name: {
    normalise: trim,
    rules: [isString('name'), maxLength('name', 100)],
  },
  description: {
    normalise: trim,
    rules: [isString('description'), maxLength('description', 2000)],
  },
  genre: {
    normalise: trim,
    rules: [isString('genre'), maxLength('genre', 60)],
  },
  maxMembers: {
    rules: [isNumber('maxMembers'), minNumber('maxMembers', 0)],
  },
  isPublic: {
    rules: [],
  },
  tags: {
    rules: [],
  },
};

export const sendMessageSchema = {
  content: {
    normalise: trim,
    rules: [required('content'), isString('content'), maxLength('content', 2000)],
  },
  bookId: {
    normalise: trim,
    rules: [isString('bookId'), maxLength('bookId', 100)],
  },
};

export const setClubBookSchema = {
  bookId: {
    normalise: trim,
    rules: [required('bookId'), isString('bookId'), maxLength('bookId', 100)],
  },
  bookTitle: {
    normalise: trim,
    rules: [required('bookTitle'), isString('bookTitle'), maxLength('bookTitle', 200)],
  },
};

export const updateProgressSchema = {
  progress: {
    rules: [isNumber('progress'), minNumber('progress', 0)],
  },
};

export const inviteMemberSchema = {
  userId: {
    normalise: trim,
    rules: [required('userId'), isString('userId'), maxLength('userId', 50)],
  },
};

export const updateRoleSchema = {
  role: {
    normalise: trim,
    rules: [
      required('role'),
      isString('role'),
      (val) => {
        const valid = ['moderator', 'member'];
        if (typeof val === 'string' && !valid.includes(val)) {
          return `role must be one of: ${valid.join(', ')}`;
        }
        return null;
      },
    ],
  },
};
