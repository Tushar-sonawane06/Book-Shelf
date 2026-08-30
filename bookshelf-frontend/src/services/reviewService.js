import api from '../utils/api.js';

/**
 * Review service.
 *
 * Mirrors the REST surface exposed by bookshelf-backend/routes/reviewRoutes.js.
 * Every function goes through `utils/api.js`, inheriting the retry policy,
 * the 10-second timeout and the normalised error shape.
 */

/**
 * Fetch paginated reviews for a book.
 *
 * @param {string} bookId
 * @param {{ page?: number, limit?: number, sort?: string }} options
 * @param {{ signal?: AbortSignal }} fetchOptions
 * @returns {Promise<{ reviews: object[], page: number, limit: number, total: number, totalPages: number }>}
 */
export async function getReviews(bookId, options = {}, { signal } = {}) {
  const { page = 1, limit = 10, sort = 'newest' } = options;

  const response = await api.get(`/reviews/book/${encodeURIComponent(bookId)}`, {
    params: { page, limit, sort },
    signal,
  });

  return response.data;
}

/**
 * Rating breakdown for a book (average, total, per-star count).
 *
 * @param {string} bookId
 * @param {{ signal?: AbortSignal }} fetchOptions
 * @returns {Promise<{ average: number, total: number, breakdown: Record<number, number> }>}
 */
export async function getReviewStats(bookId, { signal } = {}) {
  const response = await api.get(
    `/reviews/book/${encodeURIComponent(bookId)}/stats`,
    { signal }
  );

  return response.data;
}

/**
 * Submit (or update) the caller's review for a book.
 *
 * Returns the persisted review document from the server.
 *
 * @param {string} bookId
 * @param {{ rating: number, title?: string, body?: string }} payload
 * @returns {Promise<object>}
 */
export async function submitReview(bookId, { rating, title = '', body = '' }) {
  const response = await api.post(
    `/reviews/book/${encodeURIComponent(bookId)}`,
    { rating, title, body }
  );

  return response.data;
}

/**
 * Delete a review by id.
 *
 * Only the review's author may do this; the server returns 403 otherwise.
 *
 * @param {string} reviewId
 * @returns {Promise<{ message: string }>}
 */
export async function deleteReview(reviewId) {
  const response = await api.delete(
    `/reviews/${encodeURIComponent(reviewId)}`
  );

  return response.data;
}

/**
 * Toggle the "helpful" vote on a review.
 *
 * If the caller has already voted the vote is removed; otherwise it is added.
 *
 * @param {string} reviewId
 * @returns {Promise<{ helpfulCount: number, voted: boolean }>}
 */
export async function toggleHelpful(reviewId) {
  const response = await api.put(
    `/reviews/${encodeURIComponent(reviewId)}/helpful`
  );

  return response.data;
}

export default {
  getReviews,
  getReviewStats,
  submitReview,
  deleteReview,
  toggleHelpful,
};
