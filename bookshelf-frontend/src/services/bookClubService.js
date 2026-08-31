import api from '../utils/api.js';

// ── Clubs ──────────────────────────────────────────────────────────────────

/**
 * Fetch public book clubs with optional search and filtering.
 *
 * @param {object} opts
 * @param {string} [opts.q]       Search query
 * @param {string} [opts.genre]   Filter by genre
 * @param {number} [opts.page]    Page number (1-indexed)
 * @param {number} [opts.limit]   Results per page (max 50)
 * @param {AbortSignal} [opts.signal]
 */
export async function listClubs({ q, genre, page, limit, signal } = {}) {
  const params = {};
  if (q) params.q = q;
  if (genre) params.genre = genre;
  if (page) params.page = page;
  if (limit) params.limit = limit;

  const response = await api.get('/book-clubs', { params, signal });
  return response.data;
}

/**
 * Fetch clubs the current user belongs to.
 */
export async function getMyClubs({ signal } = {}) {
  const response = await api.get('/book-clubs/my', { signal });
  return response.data;
}

/**
 * Fetch a single club by ID (includes recent messages).
 */
export async function getClub(clubId, { signal } = {}) {
  const response = await api.get(`/book-clubs/${encodeURIComponent(clubId)}`, { signal });
  return response.data.club;
}

/**
 * Create a new book club.
 *
 * @param {{ name: string, description?: string, genre?: string, maxMembers?: number, isPublic?: boolean, tags?: string[] }} data
 */
export async function createClub(data) {
  const response = await api.post('/book-clubs', data);
  return response.data.club;
}

/**
 * Update club settings (owner only).
 */
export async function updateClub(clubId, data) {
  const response = await api.put(`/book-clubs/${encodeURIComponent(clubId)}`, data);
  return response.data.club;
}

/**
 * Delete a club (owner only).
 */
export async function deleteClub(clubId) {
  const response = await api.delete(`/book-clubs/${encodeURIComponent(clubId)}`);
  return response.data;
}

// ── Membership ────────────────────────────────────────────────────────────

/**
 * Join a public club.
 */
export async function joinClub(clubId) {
  const response = await api.post(`/book-clubs/${encodeURIComponent(clubId)}/join`);
  return response.data;
}

/**
 * Leave a club.
 */
export async function leaveClub(clubId) {
  const response = await api.post(`/book-clubs/${encodeURIComponent(clubId)}/leave`);
  return response.data;
}

/**
 * Remove a member (owner/moderator only).
 */
export async function removeMember(clubId, userId) {
  const response = await api.delete(
    `/book-clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(userId)}`
  );
  return response.data;
}

/**
 * Transfer club ownership.
 */
export async function transferOwnership(clubId, userId) {
  const response = await api.post(
    `/book-clubs/${encodeURIComponent(clubId)}/transfer-ownership`,
    { userId }
  );
  return response.data.club;
}

// ── Club book ─────────────────────────────────────────────────────────────

/**
 * Set or change the current club book.
 */
export async function setCurrentBook(clubId, bookId, bookTitle) {
  const response = await api.put(
    `/book-clubs/${encodeURIComponent(clubId)}/current-book`,
    { bookId, bookTitle }
  );
  return response.data.club;
}

/**
 * Update the caller's reading progress on the club book.
 */
export async function updateProgress(clubId, progress) {
  const response = await api.put(
    `/book-clubs/${encodeURIComponent(clubId)}/progress`,
    { progress }
  );
  return response.data;
}

/**
 * Get aggregated club reading stats.
 */
export async function getClubStats(clubId, { signal } = {}) {
  const response = await api.get(
    `/book-clubs/${encodeURIComponent(clubId)}/stats`,
    { signal }
  );
  return response.data;
}

// ── Discussion ────────────────────────────────────────────────────────────

/**
 * Post a message to the club discussion.
 *
 * @param {string} clubId
 * @param {{ content: string, bookId?: string }} data
 */
export async function sendMessage(clubId, data) {
  const response = await api.post(
    `/book-clubs/${encodeURIComponent(clubId)}/messages`,
    data
  );
  return response.data.msg;
}

/**
 * Delete a discussion message.
 */
export async function deleteMessage(clubId, messageId) {
  const response = await api.delete(
    `/book-clubs/${encodeURIComponent(clubId)}/messages/${encodeURIComponent(messageId)}`
  );
  return response.data;
}

export default {
  listClubs,
  getMyClubs,
  getClub,
  createClub,
  updateClub,
  deleteClub,
  joinClub,
  leaveClub,
  removeMember,
  transferOwnership,
  setCurrentBook,
  updateProgress,
  getClubStats,
  sendMessage,
  deleteMessage,
};
