import api from '../utils/api.js';

/**
 * The catalogue, from the API.
 *
 * `src/data/books.js` is a hardcoded copy of `bookshelf-backend/data/books.json`
 * that says so in its own header comment — "Kept local here for the
 * frontend-only draft". Home was moved onto the API in #274; the book detail
 * page was not, so the grid and the page it links to have been reading
 * different data ever since. Nothing keeps the two files in sync and nothing
 * would fail if they diverged. See #317.
 *
 * Every function here goes through `utils/api.js`, so it inherits the retry
 * policy (GETs only), the 10s timeout and the normalised error shape
 * `{ status, message, code }`.
 */

/** Raised for a book id the catalogue does not have. */
export class BookNotFoundError extends Error {
  constructor(bookId) {
    super(`Book not found: ${bookId}`);
    this.name = 'BookNotFoundError';
    this.status = 404;
    this.bookId = bookId;
  }
}

/**
 * Fetch one book.
 *
 * `signal` is passed through to axios so a component that unmounts, or that
 * asks for a different id, can drop the request it no longer wants.
 */
export async function getBookById(bookId, { signal } = {}) {
  if (typeof bookId !== 'string' || bookId.trim() === '') {
    throw new BookNotFoundError(String(bookId));
  }

  try {
    const response = await api.get(`/books/${encodeURIComponent(bookId.trim())}`, {
      signal,
    });
    return response.data;
  } catch (error) {
    // utils/api.js normalises to { status, code, message }; a bare axios
    // cancellation is not normalised and keeps its own shape.
    if (error?.status === 404) {
      throw new BookNotFoundError(bookId);
    }
    throw error;
  }
}

/**
 * Fetch a page of the catalogue.
 *
 * `params` maps straight onto what `utils/bookQuery.js` parses — `search`,
 * `genre` (repeatable), `minPrice`, `maxPrice`, `minRating`, `inStock`,
 * `sort`, `page`, `limit`.
 */
export async function getBooks(params = {}, { signal } = {}) {
  const response = await api.get('/books', { params, signal });
  return response.data;
}

/**
 * Resolve a list of book ids against the catalogue.
 *
 * The wishlist stores ids and nothing else, so something has to turn them
 * into books. That used to be `books.filter(b => wishlist.includes(b.id))`
 * against `src/data/books.js` — a hardcoded local copy that has drifted from
 * the API and now disagrees with it on how many books exist. `filter` is a
 * silent drop: an id the local file did not have produced no card, no
 * message and no error. See #328.
 *
 * There is no bulk endpoint, so this fans out over `GET /api/books/:id`. The
 * requests run concurrently rather than in sequence — a wishlist of twenty
 * would otherwise be twenty round trips end to end.
 *
 * Ids the catalogue does not have are reported rather than dropped. A book
 * that has been delisted is something the customer should be told about, not
 * something that quietly vanishes from a list they curated.
 *
 * Order is preserved: the result follows the order of `ids`, not the order
 * the responses happened to arrive in.
 *
 * @returns {Promise<{books: object[], missingIds: string[], failedIds: string[]}>}
 */
export async function getBooksByIds(ids, { signal } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { books: [], missingIds: [], failedIds: [] };
  }

  // De-duplicate while keeping first-seen order, so a list that somehow
  // contains an id twice does not fetch it twice or render it twice.
  const uniqueIds = [...new Set(ids.filter((id) => typeof id === 'string' && id.trim() !== ''))];

  const settled = await Promise.allSettled(
    uniqueIds.map((id) => getBookById(id, { signal }))
  );

  const books = [];
  const missingIds = [];
  const failedIds = [];

  settled.forEach((result, index) => {
    const id = uniqueIds[index];

    if (result.status === 'fulfilled') {
      books.push(result.value);
      return;
    }

    const error = result.reason;

    /*
     * A 404 is a fact about the catalogue: this book is not in it. Anything
     * else — a timeout, a 500, an aborted request — is a fact about this
     * attempt, and saying "no longer in the catalogue" about a book that is
     * merely unreachable would be wrong. They are reported separately.
     */
    if (error?.name === 'BookNotFoundError' || error?.status === 404) {
      missingIds.push(id);
    } else {
      failedIds.push(id);
    }
  });

  return { books, missingIds, failedIds };
}

/** Distinct genres with counts, from GET /api/books/genres. */
export async function getGenres({ signal } = {}) {
  const response = await api.get('/books/genres', { signal });
  return response.data?.genres ?? [];
}

/** Create a new book listing (admin only). */
export async function createBook(bookData) {
  const response = await api.post('/books', bookData);
  return response.data;
}

/** Update an existing book listing by id (admin only). */
export async function updateBook(id, bookData) {
  const response = await api.put(`/books/${encodeURIComponent(id)}`, bookData);
  return response.data;
}

/** Delete a book listing by id (admin only). */
export async function deleteBook(id) {
  const response = await api.delete(`/books/${encodeURIComponent(id)}`);
  return response.data;
}

/** Patch stock/inventory for a book by id (admin only). */
export async function updateBookStock(id, stockData) {
  const response = await api.patch(`/books/${encodeURIComponent(id)}/stock`, stockData);
  return response.data;
}

export default {
  getBookById,
  getBooks,
  getBooksByIds,
  getGenres,
  createBook,
  updateBook,
  deleteBook,
  updateBookStock,
  BookNotFoundError,
};
