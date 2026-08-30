import Order from '../models/Order.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import bookRepository from '../repositories/bookRepository.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a date range for MongoDB aggregation pipelines.
 *
 * @param {string} period — '7d' | '30d' | '90d' | '1y' | 'all'
 * @returns {{ $gte?: Date }} — a Mongoose-compatible filter, or {} for all.
 */
export function dateFilter(period) {
  if (!period || period === 'all') return {};

  const now = new Date();
  const ranges = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
  };

  const days = ranges[period];
  if (!days) return {};

  const since = new Date(now);
  since.setDate(since.getDate() - days);
  return { createdAt: { $gte: since } };
}

// ── Controllers ────────────────────────────────────────────────────────────

/**
 * @desc    Dashboard KPIs: total revenue, order count, user count, book count
 * @route   GET /api/admin/stats
 * @access  Admin
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    const [revenueResult, orderCount, userCount, books] = await Promise.all([
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.countDocuments(),
      User.countDocuments(),
      bookRepository.getBooks(),
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Compute average order value.
    const avgOrderResult = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, avg: { $avg: '$total' } } },
    ]);
    const avgOrderValue = avgOrderResult.length > 0
      ? Math.round(avgOrderResult[0].avg * 100) / 100
      : 0;

    res.status(200).json({
      totalRevenue,
      totalOrders: orderCount,
      totalUsers: userCount,
      totalBooks: books.length,
      avgOrderValue,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Revenue/sales trend over time (daily buckets)
 * @route   GET /api/admin/sales-trend
 * @access  Admin
 */
export const getSalesTrend = async (req, res, next) => {
  try {
    const period = req.query.period || '30d';
    const match = {
      paymentStatus: 'paid',
      ...dateFilter(period),
    };

    const trend = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          revenue: { $sum: '$total' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          revenue: 1,
          orderCount: 1,
        },
      },
    ]);

    res.status(200).json({ trend, period });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Monthly revenue comparison (last 12 months)
 * @route   GET /api/admin/monthly-revenue
 * @access  Admin
 */
export const getMonthlyRevenue = async (req, res, next) => {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);

    const monthly = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          revenue: { $sum: '$total' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          revenue: 1,
          orderCount: 1,
        },
      },
    ]);

    res.status(200).json({ monthly });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Top-selling books by order volume
 * @route   GET /api/admin/top-books
 * @access  Admin
 */
export const getTopBooks = async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const period = req.query.period || '30d';
    const match = {
      paymentStatus: 'paid',
      ...dateFilter(period),
    };

    const topBooks = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.bookId',
          title: { $first: '$items.title' },
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          bookId: '$_id',
          title: 1,
          totalSold: 1,
          totalRevenue: 1,
        },
      },
    ]);

    res.status(200).json({ topBooks, period });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Recent orders with summary info
 * @route   GET /api/admin/recent-orders
 * @access  Admin
 */
export const getRecentOrders = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('status paymentStatus total items createdAt shippingAddress')
      .lean();

    // Flatten the shape for the frontend.
    const mapped = orders.map((o) => ({
      id: o._id.toString(),
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: o.total,
      itemCount: o.items.length,
      customerName: o.shippingAddress?.name || 'Guest',
      createdAt: o.createdAt,
    }));

    res.status(200).json({ orders: mapped });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Order status distribution (pie-chart data)
 * @route   GET /api/admin/order-statuses
 * @access  Admin
 */
export const getOrderStatuses = async (req, res, next) => {
  try {
    const statuses = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          status: '$_id',
          count: 1,
        },
      },
    ]);

    res.status(200).json({ statuses });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    User growth over time (daily signups)
 * @route   GET /api/admin/user-growth
 * @access  Admin
 */
export const getUserGrowth = async (req, res, next) => {
  try {
    const period = req.query.period || '90d';
    const match = dateFilter(period);

    const growth = await User.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
        },
      },
    ]);

    res.status(200).json({ growth, period });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Review stats: average rating, total reviews, review count by book
 * @route   GET /api/admin/review-stats
 * @access  Admin
 */
export const getReviewStats = async (req, res, next) => {
  try {
    const [overall, byBook] = await Promise.all([
      Review.aggregate([
        { $match: { hidden: false } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            avgRating: { $avg: '$rating' },
          },
        },
      ]),
      Review.aggregate([
        { $match: { hidden: false } },
        {
          $group: {
            _id: '$bookId',
            reviewCount: { $sum: 1 },
            avgRating: { $avg: '$rating' },
          },
        },
        { $sort: { reviewCount: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            bookId: '$_id',
            reviewCount: 1,
            avgRating: { $round: ['$avgRating', 1] },
          },
        },
      ]),
    ]);

    res.status(200).json({
      totalReviews: overall.length > 0 ? overall[0].totalReviews : 0,
      avgRating: overall.length > 0 ? Math.round(overall[0].avgRating * 10) / 10 : 0,
      topReviewed: byBook,
    });
  } catch (error) {
    next(error);
  }
};
