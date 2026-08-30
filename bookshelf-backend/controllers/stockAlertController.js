import StockAlert from '../models/StockAlert.js';

// ── Subscribe to back-in-stock alert ───────────────────────────────────────

export const subscribe = async (req, res, next) => {
  try {
    const bookId = String(req.body.bookId || '').trim();
    if (!bookId) return res.status(400).json({ message: 'bookId is required' });

    const existing = await StockAlert.findOne({ userId: req.user._id, bookId });
    if (existing) {
      return res.status(409).json({ message: 'Already subscribed to this alert', alert: { ...existing.toObject(), id: existing._id.toString() } });
    }

    const alert = await StockAlert.create({ userId: req.user._id, bookId });
    res.status(201).json({ message: 'Subscribed to stock alert', alert: { ...alert.toObject(), id: alert._id.toString() } });
  } catch (error) {
    next(error);
  }
};

// ── Unsubscribe from alert ─────────────────────────────────────────────────

export const unsubscribe = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const alert = await StockAlert.findOneAndDelete({ userId: req.user._id, bookId });
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ message: 'Unsubscribed from stock alert' });
  } catch (error) {
    next(error);
  }
};

// ── Check if current user is subscribed ────────────────────────────────────

export const checkStatus = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const alert = await StockAlert.findOne({ userId: req.user._id, bookId }).lean();
    res.json({ subscribed: !!alert, alertId: alert?._id?.toString() || null });
  } catch (error) {
    next(error);
  }
};

// ── Get current user's alerts ─────────────────────────────────────────────

export const getMyAlerts = async (req, res, next) => {
  try {
    const alerts = await StockAlert.find({ userId: req.user._id, notified: false })
      .sort({ createdAt: -1 })
      .lean();
    res.json(alerts.map((a) => ({ ...a, id: a._id.toString() })));
  } catch (error) {
    next(error);
  }
};

// ── Admin: list all alerts for a book (who's waiting) ─────────────────────

export const getAlertsForBook = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const alerts = await StockAlert.find({ bookId, notified: false })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json(alerts.map((a) => ({ ...a, id: a._id.toString() })));
  } catch (error) {
    next(error);
  }
};

// ── Admin: mark alerts as notified ─────────────────────────────────────────

export const markNotified = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const result = await StockAlert.updateMany(
      { bookId, notified: false },
      { notified: true, notifiedAt: new Date() }
    );
    res.json({ message: 'Alerts marked as notified', count: result.modifiedCount });
  } catch (error) {
    next(error);
  }
};
