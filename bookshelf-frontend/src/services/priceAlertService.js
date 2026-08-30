import api from '../utils/api.js';

// ── Read ───────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's price alerts.
 *
 * @param {object} opts
 * @param {string} [opts.active]  'true' or 'false' to filter
 * @param {AbortSignal} [opts.signal]
 */
export async function getMyAlerts({ active, signal } = {}) {
  const params = {};
  if (active !== undefined) params.active = active;
  const response = await api.get('/price-alerts', { params, signal });
  return response.data;
}

/**
 * Check if the user has an active alert for a specific book.
 */
export async function checkAlert(bookId, { signal } = {}) {
  const response = await api.get(`/price-alerts/check/${encodeURIComponent(bookId)}`, { signal });
  return response.data;
}

// ── Write ──────────────────────────────────────────────────────────────────

/**
 * Create or update a price alert for a book.
 */
export async function createAlert(bookId, targetPrice) {
  const response = await api.post('/price-alerts', { bookId, targetPrice });
  return response.data;
}

/**
 * Update the target price of an existing alert.
 */
export async function updateAlert(alertId, targetPrice) {
  const response = await api.put(`/price-alerts/${encodeURIComponent(alertId)}`, { targetPrice });
  return response.data;
}

/**
 * Pause or resume an alert.
 */
export async function toggleAlert(alertId) {
  const response = await api.patch(`/price-alerts/${encodeURIComponent(alertId)}/toggle`);
  return response.data;
}

/**
 * Delete an alert by its id.
 */
export async function deleteAlert(alertId) {
  const response = await api.delete(`/price-alerts/${encodeURIComponent(alertId)}`);
  return response.data;
}

/**
 * Delete alerts for a specific book.
 */
export async function deleteByBookId(bookId) {
  const response = await api.delete(`/price-alerts/book/${encodeURIComponent(bookId)}`);
  return response.data;
}

/**
 * Admin: trigger a price check across all active alerts.
 */
export async function checkAllAlerts() {
  const response = await api.post('/price-alerts/admin/check');
  return response.data;
}

export default {
  getMyAlerts,
  checkAlert,
  createAlert,
  updateAlert,
  toggleAlert,
  deleteAlert,
  deleteByBookId,
  checkAllAlerts,
};
