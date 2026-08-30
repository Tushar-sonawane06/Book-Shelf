import api from '../utils/api.js';

/**
 * Maximum number of books that can be compared.
 * Matches the backend limit.
 */
export const MAX_COMPARE = 5;

/**
 * Fetch structured comparison data for a set of book ids.
 *
 * @param {string[]} ids  Book ids to compare (1–5)
 * @param {object} opts
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ books: object[], missingIds: string[], meta: object }>}
 */
export async function getComparison(ids, { signal } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { books: [], missingIds: [], meta: null };
  }

  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()))];
  const response = await api.get('/books/compare', {
    params: { ids: unique.join(',') },
    signal,
  });
  return response.data;
}

export default { getComparison, MAX_COMPARE };
