import api from '../utils/api.js';

/**
 * Service layer for the BookShelf admin dashboard API.
 *
 * All endpoints require an authenticated admin session. The shared axios
 * instance handles retries, timeout, and 401 propagation.
 */

/**
 * @typedef {Object} DashboardStats
 * @property {number} totalRevenue
 * @property {number} totalOrders
 * @property {number} totalUsers
 * @property {number} totalBooks
 * @property {number} avgOrderValue
 */

/**
 * @typedef {Object} SalesTrendEntry
 * @property {string} date — ISO date string (YYYY-MM-DD)
 * @property {number} revenue
 * @property {number} orderCount
 */

/**
 * @typedef {Object} TopBook
 * @property {string} bookId
 * @property {string} title
 * @property {number} totalSold
 * @property {number} totalRevenue
 */

/**
 * @typedef {Object} RecentOrder
 * @property {string} id
 * @property {string} status
 * @property {string} paymentStatus
 * @property {number} total
 * @property {number} itemCount
 * @property {string} customerName
 * @property {string} createdAt
 */

/**
 * Fetch the main dashboard KPIs.
 *
 * @param {Object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<DashboardStats>}
 */
export async function getDashboardStats({ signal } = {}) {
  const response = await api.get('/admin/stats', { signal });
  return response.data;
}

/**
 * Fetch the revenue/sales trend over time.
 *
 * @param {Object} [opts]
 * @param {string} [opts.period='30d'] — '7d' | '30d' | '90d' | '1y' | 'all'
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{trend: SalesTrendEntry[], period: string}>}
 */
export async function getSalesTrend({ period = '30d', signal } = {}) {
  const response = await api.get('/admin/sales-trend', { params: { period }, signal });
  return response.data;
}

/**
 * Fetch monthly revenue for the last 12 months.
 *
 * @param {Object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{monthly: Array<{year: number, month: number, revenue: number, orderCount: number}>}>}
 */
export async function getMonthlyRevenue({ signal } = {}) {
  const response = await api.get('/admin/monthly-revenue', { signal });
  return response.data;
}

/**
 * Fetch top-selling books.
 *
 * @param {Object} [opts]
 * @param {number} [opts.limit=10]
 * @param {string} [opts.period='30d']
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{topBooks: TopBook[], period: string}>}
 */
export async function getTopBooks({ limit = 10, period = '30d', signal } = {}) {
  const response = await api.get('/admin/top-books', { params: { limit, period }, signal });
  return response.data;
}

/**
 * Fetch recent orders.
 *
 * @param {Object} [opts]
 * @param {number} [opts.limit=10]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{orders: RecentOrder[]}>}
 */
export async function getRecentOrders({ limit = 10, signal } = {}) {
  const response = await api.get('/admin/recent-orders', { params: { limit }, signal });
  return response.data;
}

/**
 * Fetch order status distribution.
 *
 * @param {Object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{statuses: Array<{status: string, count: number}>}>}
 */
export async function getOrderStatuses({ signal } = {}) {
  const response = await api.get('/admin/order-statuses', { signal });
  return response.data;
}

/**
 * Fetch user growth over time.
 *
 * @param {Object} [opts]
 * @param {string} [opts.period='90d']
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{growth: Array<{date: string, count: number}>, period: string}>}
 */
export async function getUserGrowth({ period = '90d', signal } = {}) {
  const response = await api.get('/admin/user-growth', { params: { period }, signal });
  return response.data;
}

/**
 * Fetch review statistics.
 *
 * @param {Object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{totalReviews: number, avgRating: number, topReviewed: Array}>}
 */
export async function getReviewStats({ signal } = {}) {
  const response = await api.get('/admin/review-stats', { signal });
  return response.data;
}

export default {
  getDashboardStats,
  getSalesTrend,
  getMonthlyRevenue,
  getTopBooks,
  getRecentOrders,
  getOrderStatuses,
  getUserGrowth,
  getReviewStats,
};
