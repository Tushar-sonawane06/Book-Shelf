import { useState, useEffect } from 'react';
import { getRecentOrders } from '../services/adminService.js';
import { formatMoney } from '../utils/currency.js';

/*
 * Revenue is formatted by utils/currency.js. It used to be
 * `₹{value.toLocaleString()}` inline: a hardcoded symbol beside grouping taken
 * from the browser's locale rather than the currency's, and a method call that
 * throws outright on a row whose amount came back null.
 */

/**
 * Maps an order status to a badge class and human label.
 */
const STATUS_STYLES = {
  pending: { className: 'admin-table__badge--warning', label: 'Pending' },
  confirmed: { className: 'admin-table__badge--info', label: 'Confirmed' },
  processing: { className: 'admin-table__badge--info', label: 'Processing' },
  shipped: { className: 'admin-table__badge--info', label: 'Shipped' },
  delivered: { className: 'admin-table__badge--success', label: 'Delivered' },
  canceled: { className: 'admin-table__badge--danger', label: 'Canceled' },
  payment_failed: { className: 'admin-table__badge--danger', label: 'Failed' },
};

function statusBadge(status) {
  const style = STATUS_STYLES[status] || { className: '', label: status };
  return (
    <span className={`admin-table__badge ${style.className}`}>{style.label}</span>
  );
}

/**
 * AdminRecentOrders — table of the most recent orders with status badges.
 */
export default function AdminRecentOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setError('');

    getRecentOrders({ limit: 10, signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        setOrders(result.orders || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load recent orders');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  /**
   * Format an ISO date string into a short human-readable form.
   */
  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="admin-table-card">
      <div className="admin-table-card__header">
        <h3 className="admin-table-card__title">Recent Orders</h3>
      </div>

      {loading && (
        <div className="admin-table-card__loading">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="admin-table-card__skeleton-row" />
          ))}
        </div>
      )}

      {error && <p className="admin-table-card__error">{error}</p>}

      {!loading && !error && orders.length === 0 && (
        <p className="admin-table-card__empty">No orders yet.</p>
      )}

      {!loading && !error && orders.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Items</th>
              <th className="admin-table__right">Total</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="admin-table__rank">
                  #{order.id.slice(-6).toUpperCase()}
                </td>
                <td className="admin-table__name">{order.customerName}</td>
                <td>{order.itemCount}</td>
                <td className="admin-table__right">
                  {formatMoney(order.total, { minimumFractionDigits: 0 })}
                </td>
                <td>{statusBadge(order.status)}</td>
                <td>{formatDate(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
