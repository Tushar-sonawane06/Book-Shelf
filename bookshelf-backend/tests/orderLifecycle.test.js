import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  updateOrderStatus,
  cancelOrder,
  getAllOrders,
} from '../controllers/orderController.js';
import orderRepository from '../repositories/orderRepository.js';

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('Order Lifecycle & Cancellation Controllers', () => {
  test('updateOrderStatus rejects invalid status string', async () => {
    const req = { params: { id: 'order1' }, body: { status: 'invalid_status' } };
    const res = makeRes();

    await updateOrderStatus(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Invalid status/);
  });

  test('updateOrderStatus updates order status successfully', async () => {
    const originalFindById = orderRepository.findById;
    const originalUpdateStatus = orderRepository.updateStatus;

    orderRepository.findById = async () => ({ _id: 'order1', status: 'pending' });
    orderRepository.updateStatus = async (id, status) => ({
      _id: id,
      status,
    });

    try {
      const req = { params: { id: 'order1' }, body: { status: 'shipped' } };
      const res = makeRes();

      await updateOrderStatus(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.order.status, 'shipped');
    } finally {
      orderRepository.findById = originalFindById;
      orderRepository.updateStatus = originalUpdateStatus;
    }
  });

  test('cancelOrder allows user to cancel pending order', async () => {
    const originalFindById = orderRepository.findById;
    const originalCancelOrder = orderRepository.cancelOrder;

    orderRepository.findById = async () => ({
      _id: 'order1',
      userId: 'user123',
      status: 'pending',
    });
    orderRepository.cancelOrder = async (id) => ({
      _id: id,
      userId: 'user123',
      status: 'canceled',
      paymentStatus: 'canceled',
    });

    try {
      const req = {
        params: { id: 'order1' },
        user: { _id: 'user123', role: 'user' },
      };
      const res = makeRes();

      await cancelOrder(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.order.status, 'canceled');
      assert.match(res.body.message, /canceled successfully/);
    } finally {
      orderRepository.findById = originalFindById;
      orderRepository.cancelOrder = originalCancelOrder;
    }
  });

  test('cancelOrder refuses cancellation of shipped order', async () => {
    const originalFindById = orderRepository.findById;

    orderRepository.findById = async () => ({
      _id: 'order1',
      userId: 'user123',
      status: 'shipped',
    });

    try {
      const req = {
        params: { id: 'order1' },
        user: { _id: 'user123', role: 'user' },
      };
      const res = makeRes();

      await cancelOrder(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Cannot cancel an order that has already been shipped/);
    } finally {
      orderRepository.findById = originalFindById;
    }
  });

  test('cancelOrder checks user ownership', async () => {
    const originalFindById = orderRepository.findById;

    orderRepository.findById = async () => ({
      _id: 'order1',
      userId: 'other_user_456',
      status: 'pending',
    });

    try {
      const req = {
        params: { id: 'order1' },
        user: { _id: 'user123', role: 'user' },
      };
      const res = makeRes();

      await cancelOrder(req, res, () => {});

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Not authorized/);
    } finally {
      orderRepository.findById = originalFindById;
    }
  });

  test('getAllOrders returns paginated results when query parameters provided', async () => {
    const originalFindWithPagination = orderRepository.findWithPagination;

    orderRepository.findWithPagination = async ({ status, page, limit }) => ({
      orders: [{ _id: 'order1', status: status || 'pending' }],
      total: 1,
      page: Number(page || 1),
      pages: 1,
    });

    try {
      const req = { query: { status: 'shipped', page: '1', limit: '10' } };
      const res = makeRes();

      await getAllOrders(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.total, 1);
      assert.equal(res.body.orders[0].status, 'shipped');
    } finally {
      orderRepository.findWithPagination = originalFindWithPagination;
    }
  });
});
