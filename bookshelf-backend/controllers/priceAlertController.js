import PriceAlert from '../models/PriceAlert.js';
import bookRepository from '../repositories/bookRepository.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatAlert(alert) {
  const obj = alert.toObject ? alert.toObject() : alert;
  return {
    id: obj._id.toString(),
    bookId: obj.bookId,
    targetPrice: obj.targetPrice,
    currentPriceAtCreation: obj.currentPriceAtCreation,
    active: obj.active,
    notified: obj.notified,
    notifiedAt: obj.notifiedAt,
    createdAt: obj.createdAt,
  };
}

/**
 * Look up the current price of a book from the catalogue.
 * Returns null if the book does not exist — callers treat null as "unknown".
 */
function getCurrentPrice(bookId) {
  const book = bookRepository.getBookById(bookId);
  return book?.price ?? null;
}

// ── Create a price alert ───────────────────────────────────────────────────

/**
 * @desc    Set a price drop alert for a book
 * @route   POST /api/price-alerts
 * @access  Authenticated
 */
export const createAlert = async (req, res, next) => {
  try {
    const { bookId, targetPrice } = req.body;
    const userId = req.user._id;

    // Check for existing active alert on this book
    const existing = await PriceAlert.findOne({ userId, bookId, active: true });
    if (existing) {
      // Update the target price instead of creating a duplicate
      existing.targetPrice = targetPrice;
      await existing.save();

      return res.json({
        message: 'Alert updated to new target price',
        alert: formatAlert(existing),
      });
    }

    const currentPrice = getCurrentPrice(bookId);

    const alert = await PriceAlert.create({
      userId,
      bookId,
      targetPrice,
      currentPriceAtCreation: currentPrice,
    });

    res.status(201).json({
      message: 'Price alert created',
      alert: formatAlert(alert),
    });
  } catch (error) {
    next(error);
  }
};

// ── Get all alerts for the current user ────────────────────────────────────

/**
 * @desc    Get the current user's price alerts
 * @route   GET /api/price-alerts
 * @access  Authenticated
 */
export const getMyAlerts = async (req, res, next) => {
  try {
    const { active } = req.query;
    const filter = { userId: req.user._id };
    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;

    const alerts = await PriceAlert.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with current prices from the catalogue
    const enriched = alerts.map((a) => {
      const currentPrice = getCurrentPrice(a.bookId);
      return {
        ...formatAlert(a),
        currentPrice,
        priceChanged: currentPrice !== null && currentPrice !== a.currentPriceAtCreation,
        isAtOrBelow:
          currentPrice !== null && currentPrice <= a.targetPrice,
      };
    });

    res.json(enriched);
  } catch (error) {
    next(error);
  }
};

// ── Check alert status for a specific book ─────────────────────────────────

/**
 * @desc    Check if the user has an active alert for a book
 * @route   GET /api/price-alerts/check/:bookId
 * @access  Authenticated
 */
export const checkAlert = async (req, res, next) => {
  try {
    const alert = await PriceAlert.findOne({
      userId: req.user._id,
      bookId: req.params.bookId,
      active: true,
    }).lean();

    if (!alert) {
      return res.json({ hasAlert: false, alert: null });
    }

    const currentPrice = getCurrentPrice(alert.bookId);
    res.json({
      hasAlert: true,
      alert: {
        ...formatAlert(alert),
        currentPrice,
        isAtOrBelow: currentPrice !== null && currentPrice <= alert.targetPrice,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Toggle active state ────────────────────────────────────────────────────

/**
 * @desc    Pause or resume a price alert
 * @route   PATCH /api/price-alerts/:alertId/toggle
 * @access  Authenticated (owner only)
 */
export const toggleAlert = async (req, res, next) => {
  try {
    const alert = await PriceAlert.findById(req.params.alertId);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (alert.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your alert' });
    }

    alert.active = !alert.active;
    await alert.save();

    res.json({
      message: alert.active ? 'Alert resumed' : 'Alert paused',
      alert: formatAlert(alert),
    });
  } catch (error) {
    next(error);
  }
};

// ── Update target price ────────────────────────────────────────────────────

/**
 * @desc    Change the target price of an alert
 * @route   PUT /api/price-alerts/:alertId
 * @access  Authenticated (owner only)
 */
export const updateAlert = async (req, res, next) => {
  try {
    const { targetPrice } = req.body;
    if (typeof targetPrice !== 'number' || targetPrice < 0) {
      return res.status(400).json({ message: 'Valid targetPrice is required' });
    }

    const alert = await PriceAlert.findById(req.params.alertId);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (alert.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your alert' });
    }

    alert.targetPrice = targetPrice;
    alert.notified = false;
    alert.notifiedAt = null;
    await alert.save();

    res.json({
      message: 'Target price updated',
      alert: formatAlert(alert),
    });
  } catch (error) {
    next(error);
  }
};

// ── Delete an alert ────────────────────────────────────────────────────────

/**
 * @desc    Delete a price alert
 * @route   DELETE /api/price-alerts/:alertId
 * @access  Authenticated (owner only)
 */
export const deleteAlert = async (req, res, next) => {
  try {
    const alert = await PriceAlert.findById(req.params.alertId);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (alert.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your alert' });
    }

    await PriceAlert.findByIdAndDelete(req.params.alertId);
    res.json({ message: 'Alert deleted' });
  } catch (error) {
    next(error);
  }
};

// ── Delete by bookId (convenience) ─────────────────────────────────────────

/**
 * @desc    Delete alerts for a specific book
 * @route   DELETE /api/price-alerts/book/:bookId
 * @access  Authenticated
 */
export const deleteByBookId = async (req, res, next) => {
  try {
    const result = await PriceAlert.findOneAndDelete({
      userId: req.user._id,
      bookId: req.params.bookId,
    });

    if (!result) {
      return res.status(404).json({ message: 'No alert found for this book' });
    }

    res.json({ message: 'Alert deleted' });
  } catch (error) {
    next(error);
  }
};

// ── Admin: check all alerts against current prices ─────────────────────────

/**
 * @desc    Admin: check all active alerts and mark triggered ones
 * @route   POST /api/price-alerts/admin/check
 * @access  Admin
 *
 * This is the "sweeper" endpoint — a cron or manual trigger would call
 * this periodically. It scans every active alert, compares the current
 * catalogue price to the target, and marks matching alerts as notified.
 */
export const checkAllAlerts = async (req, res, next) => {
  try {
    const activeAlerts = await PriceAlert.find({ active: true }).lean();

    let triggered = 0;
    let alreadyNotified = 0;

    for (const alert of activeAlerts) {
      if (alert.notified) {
        alreadyNotified++;
        continue;
      }

      const currentPrice = getCurrentPrice(alert.bookId);
      if (currentPrice !== null && currentPrice <= alert.targetPrice) {
        await PriceAlert.findByIdAndUpdate(alert._id, {
          notified: true,
          notifiedAt: new Date(),
        });
        triggered++;
      }
    }

    res.json({
      message: 'Price check complete',
      totalActive: activeAlerts.length,
      triggered,
      alreadyNotified,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createAlert,
  getMyAlerts,
  checkAlert,
  toggleAlert,
  updateAlert,
  deleteAlert,
  deleteByBookId,
  checkAllAlerts,
};
