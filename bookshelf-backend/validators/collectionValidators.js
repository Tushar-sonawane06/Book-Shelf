import { required, trim } from '../utils/validators.js';
import { bookIdRule, normaliseBookId } from '../utils/wishlist.js';
import {
  MAX_COLLECTION_DESCRIPTION_LENGTH,
  MAX_COLLECTION_NAME_LENGTH,
  booleanRule,
  normaliseBoolean,
  normaliseOptionalText,
  optionalTextRule,
  presentTextRule,
} from '../utils/collection.js';

/**
 * POST /api/collections
 *
 * `validateBody` replaces req.body with only the fields named here, which is
 * the same protection the auth and wishlist routes get: a request carrying an
 * extra key cannot smuggle it through to `Collection.create`.
 *
 * Note what that means for the controller — by the time it runs, `name` is a
 * trimmed non-empty string of a known length. The `name.trim()` that used to
 * throw a TypeError on `{}` and reach the client as a 500 is gone, not
 * because it was wrapped in a try, but because there is no longer a way to
 * reach it with something that is not a string. See #419.
 */
export const createCollectionSchema = {
  name: {
    normalise: trim,
    rules: [
      required('name'),
      optionalTextRule('name', MAX_COLLECTION_NAME_LENGTH),
    ],
  },
  description: {
    normalise: normaliseOptionalText,
    rules: [optionalTextRule('description', MAX_COLLECTION_DESCRIPTION_LENGTH)],
  },
  isPublic: {
    normalise: normaliseBoolean,
    rules: [booleanRule('isPublic')],
  },
};

/**
 * PUT /api/collections/:id
 *
 * Deliberately not `createCollectionSchema` reused: an update is partial. A
 * request that only flips `isPublic` must not be made to resend the name, so
 * nothing here is `required` — but a field that *is* present still has to be
 * usable, which is what `presentTextRule` adds over `optionalTextRule`.
 */
export const updateCollectionSchema = {
  name: {
    normalise: normaliseOptionalText,
    rules: [presentTextRule('name', MAX_COLLECTION_NAME_LENGTH)],
  },
  description: {
    normalise: normaliseOptionalText,
    rules: [optionalTextRule('description', MAX_COLLECTION_DESCRIPTION_LENGTH)],
  },
  isPublic: {
    normalise: normaliseBoolean,
    rules: [booleanRule('isPublic')],
  },
};

/**
 * POST /api/collections/:id/books
 *
 * The endpoint that answered 200 OK to an empty body and stored a book id of
 * `"undefined"`. `normaliseBookId` leaves a non-string alone rather than
 * coercing it, so `bookIdRule` can say what actually arrived — which is the
 * whole difference between this and `String(req.body.bookId)`.
 *
 * Shares `bookIdRule` with the wishlist: the two features store the same kind
 * of identifier, and two different opinions about what a book id may look
 * like is how they drift apart.
 */
export const addBookSchema = {
  bookId: {
    normalise: normaliseBookId,
    rules: [required('bookId'), bookIdRule('bookId')],
  },
};

export default {
  createCollectionSchema,
  updateCollectionSchema,
  addBookSchema,
};
