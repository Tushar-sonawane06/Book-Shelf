/**
 * Collection input rules, as pure functions.
 *
 * The collections routes were the last write endpoints in the API with
 * nothing in front of them. Everything else goes through
 * `validateBody(schema)` — see routes/authRoutes.js and routes/wishlistRoutes.js
 * — while `collectionController` read `req.body` and called string methods on
 * values it had not checked:
 *
 *   POST /api/collections            {}               -> name.trim() throws, 500
 *   PUT  /api/collections/:id        {description: 7} -> description.trim() throws, 500
 *   POST /api/collections/:id/books  {}               -> stores the string "undefined"
 *
 * The third is the interesting one. It read
 *
 *     const bookId = String(req.body.bookId).trim();
 *     if (!bookId) return res.status(400)...
 *
 * and `String(undefined)` is `'undefined'` — seven characters, and truthy.
 * The guard let it through, the endpoint answered 200, and a book id of
 * `"undefined"` was written into the collection permanently. See #419.
 *
 * The same trap, and the same shape of fix, as utils/wishlist.js.
 */

/**
 * The `Collection` schema's own caps, stated here so validation refuses
 * before Mongoose throws. A ValidationError reaches the client as a 500
 * through `next(error)`; a rule reaches it as a field-level 400.
 */
export const MAX_COLLECTION_NAME_LENGTH = 80;
export const MAX_COLLECTION_DESCRIPTION_LENGTH = 300;

/**
 * A cap on how many books one collection may hold.
 *
 * `bookIds: [{ type: String }]` had none, so a loop over
 * POST /api/collections/:id/books grew a single document until it reached
 * Mongo's 16 MB ceiling — after which every save on that collection fails,
 * not only the ones adding books. The same hole wishlists had, capped for the
 * same reason.
 */
export const MAX_BOOKS_PER_COLLECTION = 200;

/**
 * Control characters have no place in a name that will be printed back into
 * a page, a log line, or an error message.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/**
 * Trim a value that may legitimately be absent.
 *
 * Returns `undefined` and `null` untouched rather than coercing them, so a
 * PUT that omits a field stays distinguishable from one that clears it.
 * `String(undefined)` would collapse those into the same request, which is
 * the bug above.
 */
export function normaliseOptionalText(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return typeof value === 'string' ? value.trim() : value;
}

/**
 * A rule for a field that may be omitted but must be a sane string when it is
 * present.
 *
 * `required()` from utils/validators.js reports a *missing* value, which is
 * not what a partial update wants: `PUT /api/collections/:id` changing only
 * `isPublic` must not be forced to resend the name.
 */
export function optionalTextRule(field, max) {
  return (value) => {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return `${field} must be a string`;
    }

    if (value.length > max) {
      return `${field} must be at most ${max} characters`;
    }

    if (CONTROL_CHARACTERS.test(value)) {
      return `${field} contains characters that are not allowed`;
    }

    return null;
  };
}

/**
 * Like `optionalTextRule`, but a present value may not be blank.
 *
 * A collection called `''` is not one anyone asked for, and the unique index
 * on `{ userId, name }` means the first one blocks every later attempt.
 */
export function presentTextRule(field, max) {
  return (value) => {
    if (value === undefined || value === null) {
      return null;
    }

    if (value === '') {
      return `${field} cannot be empty`;
    }

    return optionalTextRule(field, max)(value);
  };
}

/**
 * The booleans an HTML form and a JSON client can each plausibly send.
 *
 * `isPublic` was coerced with `Boolean(isPublic)`, so the *string* `"false"`
 * — which is what a form field sends — made a collection public. Everything
 * outside this table is refused rather than guessed at: `Boolean("no")` is
 * `true`, and a caller who meant private deserves an error rather than a
 * public collection.
 */
const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY = new Set(['false', '0', 'no', 'off']);

export function normaliseBoolean(value) {
  if (typeof value === 'boolean' || value === undefined || value === null) {
    return value;
  }

  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();

    if (TRUTHY.has(lowered)) return true;
    if (FALSY.has(lowered)) return false;
  }

  // Left as it arrived, so the rule below can name what was actually sent.
  return value;
}

export function booleanRule(field) {
  return (value) => {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'boolean') {
      return `${field} must be true or false`;
    }

    return null;
  };
}

/**
 * Whether a collection has room for one more book.
 *
 * Separate from the rules because it needs the stored document, which a body
 * validator never sees.
 */
export function hasCapacity(bookIds, max = MAX_BOOKS_PER_COLLECTION) {
  return (Array.isArray(bookIds) ? bookIds.length : 0) < max;
}

export default {
  MAX_COLLECTION_NAME_LENGTH,
  MAX_COLLECTION_DESCRIPTION_LENGTH,
  MAX_BOOKS_PER_COLLECTION,
  normaliseOptionalText,
  optionalTextRule,
  presentTextRule,
  normaliseBoolean,
  booleanRule,
  hasCapacity,
};
