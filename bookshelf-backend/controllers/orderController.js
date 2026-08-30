import orderRepository from '../repositories/orderRepository.js';
import { canAccess } from '../utils/roles.js';

const VALID_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'canceled',
  'payment_failed',
];

// @desc    Get logged in user orders
// @route   GET /api/orders/mine
// @access  Private
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await orderRepository.findByUserId(req.user._id);
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private — the owner, or an admin
const getOrderById = async (req, res, next) => {
  try {
    const order = await orderRepository.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!canAccess(req.user, order.userId)) {
      return res
        .status(403)
        .json({ message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Order not found' });
    }

    next(error);
  }
};

// @desc    Get every order with pagination & filtering
// @route   GET /api/orders
// @access  Admin
const getAllOrders = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    if (status || page || limit) {
      const result = await orderRepository.findWithPagination({ status, page, limit });
      return res.json(result);
    }
    const orders = await orderRepository.findAll();
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Admin
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const order = await orderRepository.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const updatedOrder = await orderRepository.updateStatus(req.params.id, status);

    res.status(200).json({
      message: `Order status updated to ${status}`,
      order: updatedOrder,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Order not found' });
    }
    next(error);
  }
};

// @desc    Cancel an order
// @route   POST /api/orders/:id/cancel
// @access  Private (Owner or Admin)
const cancelOrder = async (req, res, next) => {
  try {
    const order = await orderRepository.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!canAccess(req.user, order.userId)) {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }

    if (order.status === 'shipped' || order.status === 'delivered') {
      return res.status(400).json({
        message: `Cannot cancel an order that has already been ${order.status}`,
      });
    }

    if (order.status === 'canceled') {
      return res.status(200).json({
        message: 'Order is already canceled',
        order,
      });
    }

    const canceledOrder = await orderRepository.cancelOrder(req.params.id);

    res.status(200).json({
      message: 'Order canceled successfully and inventory restored',
      order: canceledOrder,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Order not found' });
    }
    next(error);
  }
};

export { getMyOrders, getOrderById, getAllOrders, updateOrderStatus, cancelOrder };
