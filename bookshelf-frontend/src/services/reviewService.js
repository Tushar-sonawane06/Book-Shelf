import api from '../utils/api.js';

// ── Public ─────────────────────────────────────────────────────────────────

/**
 * Fetch a paginated, sortable list of visible reviews for a book.
 *
 * @param {string} bookId
 * @param {object}  opts
 * @param {number}  [opts.page=1]
 * @param {number}  [opts.limit=10]
 * @param {string}  [opts.sort='newest']  newest | oldest | highest | lowest | helpful
 * @param {AbortSignal} [opts.signal]
 */
export async function getBookReviews(bookId, { page = 1, limit = 10, sort = 'newest', signal } = {}) {
  const response = await api.get(`/reviews/book/${encodeURIComponent(bookId)}`, {
    params: { page, limit, sort },
    signal,
  });
  return response.data;
}

/**
 * Fetch a single review by id.
 */
export async function getReview(reviewId, { signal } = {}) {
  const response = await api.get(`/reviews/${encodeURIComponent(reviewId)}`, { signal });
  return response.data;
}

// ── Authenticated ──────────────────────────────────────────────────────────

/**
 * Submit a new review for a book.
 *
 * @param {{ bookId: string, rating: number, title?: string, body?: string }} data
 */
export async function createReview(data) {
  const response = await api.post('/reviews', data);
  return response.data;
}

/**
 * Update an existing review.
 *
 * @param {string} reviewId
 * @param {{ rating?: number, title?: string, body?: string }} data
 */
export async function updateReview(reviewId, data) {
  const response = await api.put(`/reviews/${encodeURIComponent(reviewId)}`, data);
  return response.data;
}

/**
 * Delete a review.
 */
export async function deleteReview(reviewId) {
  const response = await api.delete(`/reviews/${encodeURIComponent(reviewId)}`);
  return response.data;
}

/**
 * Toggle the "helpful" vote on a review.
 */
export async function toggleHelpful(reviewId) {
  const response = await api.post(`/reviews/${encodeURIComponent(reviewId)}/helpful`);
  return response.data;
}

/**
 * Check if the current user has already reviewed a specific book.
 *
 * @returns {Promise<{ hasReview: boolean, review: object|null }>}
 */
export async function getMyReviewForBook(bookId, { signal } = {}) {
  const response = await api.get(`/reviews/book/${encodeURIComponent(bookId)}/mine`, {
    signal,
  });
  return response.data;
}

// ── Admin ──────────────────────────────────────────────────────────────────

/**
 * Admin: list all reviews for a book, including hidden ones.
 */
export async function adminGetBookReviews(bookId, { page = 1, limit = 20, signal } = {}) {
  const response = await api.get(`/reviews/admin/book/${encodeURIComponent(bookId)}`, {
    params: { page, limit },
    signal,
  });
  return response.data;
}

/**
 * Admin: toggle a review's visibility.
 */
export async function adminToggleVisibility(reviewId) {
  const response = await api.patch(`/reviews/${encodeURIComponent(reviewId)}/visibility`);
  return response.data;
}

export default {
  getBookReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  toggleHelpful,
  getMyReviewForBook,
  adminGetBookReviews,
  adminToggleVisibility,
};
