import Order from '../models/Order.js';
import { restoreInventory } from './bookRepository.js';

class OrderRepository {
  async findByUserId(userId) {
    return await Order.find({ userId }).sort({ createdAt: -1 });
  }

  async findById(id) {
    return await Order.findById(id);
  }

  async findAll() {
    return await Order.find({}).sort({ createdAt: -1 });
  }

  async findWithPagination({ status, userId, page = 1, limit = 20 } = {}) {
    const query = {};
    if (status) {
      query.status = status;
    }
    if (userId) {
      query.userId = userId;
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const parsedLimit = Math.max(1, Number(limit));

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(parsedLimit),
      Order.countDocuments(query),
    ]);

    return {
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / parsedLimit) || 1,
    };
  }

  async updateStatus(id, status) {
    const order = await Order.findById(id);
    if (!order) return null;

    const oldStatus = order.status;
    order.status = status;

    // If order transitioned to canceled and inventory hold was not yet released, refund stock
    if (status === 'canceled' && oldStatus !== 'canceled' && !order.reservationReleasedAt) {
      const itemsToRestore = order.items.map((i) => ({
        bookId: i.bookId,
        quantity: i.quantity,
      }));
      restoreInventory(itemsToRestore);
      order.reservationReleasedAt = new Date();
      order.paymentStatus = 'canceled';
    }

    return await order.save();
  }

  async cancelOrder(id) {
    return await this.updateStatus(id, 'canceled');
  }

  /**
   * Orders still holding inventory they have not paid for, reserved before
   * `before`.
   */
  async findExpiredReservations({ before, limit = 200 } = {}) {
    return await Order.find({
      reservationReleasedAt: null,
      $or: [
        {
          paymentStatus: 'pending',
          $or: [
            { reservedAt: { $lte: before } },
            { reservedAt: { $exists: false }, createdAt: { $lte: before } },
          ],
        },
        {
          paymentStatus: { $in: ['failed', 'canceled'] },
        },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(limit);
  }

  async create(orderData) {
    const order = new Order(orderData);
    return await order.save();
  }

  async save(orderDocument) {
    return await orderDocument.save();
  }
}

export default new OrderRepository();
