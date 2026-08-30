import api from '../utils/api.js';

// ── Read ───────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's reading list.
 *
 * @param {object} opts
 * @param {string} [opts.shelf]  Filter to one shelf
 * @param {AbortSignal} [opts.signal]
 */
export async function getMyReadingList({ shelf, signal } = {}) {
  const params = {};
  if (shelf) params.shelf = shelf;
  const response = await api.get('/reading-list', { params, signal });
  return response.data;
}

/**
 * Fetch reading statistics (shelf counts, average rating, current progress).
 */
export async function getReadingStats({ signal } = {}) {
  const response = await api.get('/reading-list/stats', { signal });
  return response.data;
}

/**
 * Check if a book is on the user's reading list.
 *
 * @returns {Promise<{ onList: boolean, entry: object|null }>}
 */
export async function checkReadingList(bookId, { signal } = {}) {
  const response = await api.get(`/reading-list/check/${encodeURIComponent(bookId)}`, { signal });
  return response.data;
}

// ── Write ──────────────────────────────────────────────────────────────────

/**
 * Add a book to the reading list, or move it to a different shelf.
 *
 * If the book is already on the list, the existing entry is updated.
 *
 * @param {{ bookId: string, shelf?: string, notes?: string, rating?: number }} data
 */
export async function addToList(data) {
  const response = await api.post('/reading-list', data);
  return response.data;
}

/**
 * Update an existing reading list entry.
 *
 * @param {string} entryId
 * @param {{ shelf?: string, notes?: string, rating?: number, progress?: number }} data
 */
export async function updateEntry(entryId, data) {
  const response = await api.put(`/reading-list/${encodeURIComponent(entryId)}`, data);
  return response.data;
}

/**
 * Remove an entry by its id.
 */
export async function removeEntry(entryId) {
  const response = await api.delete(`/reading-list/${encodeURIComponent(entryId)}`);
  return response.data;
}

/**
 * Remove a book by its bookId (convenience for toggle patterns).
 */
export async function removeByBookId(bookId) {
  const response = await api.delete(`/reading-list/book/${encodeURIComponent(bookId)}`);
  return response.data;
}

/**
 * Reorder entries within a shelf.
 *
 * @param {string} shelf
 * @param {string[]} orderedIds  Entry ids in desired order
 */
export async function reorderEntries(shelf, orderedIds) {
  const response = await api.put('/reading-list/reorder', { shelf, orderedIds });
  return response.data;
}

export default {
  getMyReadingList,
  getReadingStats,
  checkReadingList,
  addToList,
  updateEntry,
  removeEntry,
  removeByBookId,
  reorderEntries,
};
