import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import OrderCard from '../components/orders/OrderCard.jsx';
import EmptyOrders from '../components/orders/EmptyOrders.jsx';
import SkeletonLoader from '../components/SkeletonLoader.jsx';
import { useOrders } from '../hooks/useOrders.js';
import { countOrderItems, formatTotalSpent } from '../utils/orderFormat.js';
import './OrderHistory.css';
import { usePageMetadata } from '../hooks/usePageMetadata.js';

import StatusBadge from '../components/StatusBadge.jsx';

export default function OrderHistory() {
  usePageMetadata({
    title: 'Your orders',
    description:
      'Every order you have placed with BookShelf, with its status, contents and total.',
  });

  const { t } = useTranslation();

  const { orders, loading, error, refetch } = useOrders();

  const orderCount = orders.length;
  const bookCount = orders.reduce((total, order) => total + countOrderItems(order), 0);
  const spent = formatTotalSpent(orders);

  return (
    <div className="page-container order-history-page">
      <header className="order-history__header">
        <h2>{t('orderHistory.title', 'Your Order History')}</h2>
        {!loading && !error && orderCount > 0 && (
          <p className="order-history__summary" data-testid="order-history-summary">
            {t('orderHistory.orderCount', {
              count: orderCount,
              defaultValue_one: '{{count}} order',
              defaultValue_other: '{{count}} orders',
            })}{' '}
            &middot;{' '}
            {t('orderHistory.bookCount', {
              count: bookCount,
              defaultValue_one: '{{count}} book',
              defaultValue_other: '{{count}} books',
            })}{' '}
            &middot;{' '}
            {t('orderHistory.totalPaid', {
              amount: spent,
              defaultValue: '{{amount}} paid',
            })}
          </p>
        )}
      </header>

      {loading && (
        <div className="orders-list" aria-busy="true" aria-label="Loading orders">
          <SkeletonLoader variant="order" count={3} />
        </div>
      )}

      {!loading && error && (
        <div className="order-history__error" role="alert">
          <h3>{t('orderHistory.loadError', 'We could not load your orders')}</h3>
          <p>
            {error.message ||
              t('common.genericError', 'Something went wrong. Please try again.')}
          </p>
          <div className="order-history__error-actions">
            <button type="button" className="order-history__retry" onClick={refetch}>
              {t('orderHistory.retry', 'Try again')}
            </button>
            {error.status === 401 && (
              <Link className="order-history__signin" to="/login?redirect=/orders">
                {t('orderHistory.signIn', 'Sign in')}
              </Link>
            )}
          </div>
        </div>
      )}

      {!loading && !error && orderCount === 0 && <EmptyOrders />}

      {!loading && !error && orderCount > 0 && (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order._id ?? order.id} style={{ marginBottom: '16px' }}>
              <div style={{ marginBottom: '8px' }}>
                <StatusBadge status={order.isPaid ? 'success' : 'pending'} text={order.isPaid ? 'Paid & Processing' : 'Pending Payment'} />
              </div>
              <OrderCard order={order} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
