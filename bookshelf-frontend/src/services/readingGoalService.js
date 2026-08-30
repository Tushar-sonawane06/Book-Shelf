import api from '../utils/api.js';

/**
 * Get the user's reading goal for a year.
 */
export async function getGoal(year, { signal } = {}) {
  const params = {};
  if (year) params.year = year;
  const response = await api.get('/reading-goals', { params, signal });
  return response.data;
}

/**
 * Set or update the yearly reading goal.
 */
export async function setGoal(yearlyGoal, year) {
  const response = await api.put('/reading-goals', { yearlyGoal, year });
  return response.data;
}

/**
 * Record that a book was finished in a given month.
 */
export async function recordCompletion(month, year) {
  const response = await api.post('/reading-goals/complete', { month, year });
  return response.data;
}

/**
 * Undo a book completion for a given month.
 */
export async function undoCompletion(month, year) {
  const response = await api.post('/reading-goals/uncomplete', { month, year });
  return response.data;
}

/**
 * Get reading goal history for multiple years.
 */
export async function getHistory(years, { signal } = {}) {
  const params = {};
  if (years) params.years = years;
  const response = await api.get('/reading-goals/history', { params, signal });
  return response.data;
}

export default { getGoal, setGoal, recordCompletion, undoCompletion, getHistory };
