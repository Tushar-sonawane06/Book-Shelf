import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getMyAlerts,
  toggleAlert,
  deleteAlert,
} from '../services/priceAlertService.js';
import { formatPrice } from '../utils/bookFormat.js';
import './PriceAlertsPage.css';

/**
 * Full-page view of the user's price drop alerts.
 *
 * Shows active and past alerts in a tabbed layout. Each card displays the
 * book id, target price, current price (with change indicator), and action
 * buttons to pause/resume or delete.
 */
export default function PriceAlertsPage() {
  const { user } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [message, setMessage] = useState('');

  const flash = useCallback((msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  }, []);

  const loadAlerts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (tab === 'active') params.active = 'true';
      if (tab === 'triggered') params.active = 'false';
      const data = await getMyAlerts(params);
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [user, tab]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  async function handleToggle(alertId) {
    try {
      const data = await toggleAlert(alertId);
      flash(data.message);
      loadAlerts();
    } catch (err) {
      flash(err?.message || 'Failed to toggle alert');
    }
  }

  async function handleDelete(alertId) {
    if (!window.confirm('Delete this price alert?')) return;
    try {
      await deleteAlert(alertId);
      flash('Alert deleted');
      loadAlerts();
    } catch (err) {
      flash(err?.message || 'Failed to delete alert');
    }
  }

  // Filter by tab locally for immediate UI feedback
  const filtered = alerts.filter((a) => {
    if (tab === 'active') return a.active && !a.notified;
    if (tab === 'triggered') return a.notified;
    return true;
  });

  const tabs = [
    { key: 'all', label: 'All', count: alerts.length },
    { key: 'active', label: '🔔 Active', count: alerts.filter((a) => a.active && !a.notified).length },
    { key: 'triggered', label: '🎉 Triggered', count: alerts.filter((a) => a.notified).length },
  ];

  if (!user) {
    return (
      <main className="pa-page">
        <div className="pa-page__empty">
          <h2>Price Alerts</h2>
          <p>Log in to manage your price drop alerts.</p>
          <Link to="/login" className="pa-page__login-btn">Log in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pa-page">
      <header className="pa-page__header">
        <h1 className="pa-page__title">🔔 Price Drop Alerts</h1>
        <Link to="/" className="pa-page__browse-link">Browse books →</Link>
      </header>

      {message && (
        <div className="pa-page__toast" role="status">{message}</div>
      )}

      {/* Tabs */}
      <div className="pa-page__tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`pa-page__tab ${tab === t.key ? 'pa-page__tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="pa-page__tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="pa-page__loading">
          <span className="pa-page__spinner" />
          <span>Loading alerts…</span>
        </div>
      ) : error ? (
        <div className="pa-page__error" role="alert">
          {error}
          <button type="button" onClick={loadAlerts}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="pa-page__empty-state">
          <span className="pa-page__empty-icon">
            {tab === 'triggered' ? '🎉' : '🔔'}
          </span>
          <p>
            {tab === 'triggered'
              ? 'No triggered alerts yet. We\'ll notify you when prices drop!'
              : 'No price alerts yet. Browse a book and set an alert to get started.'}
          </p>
        </div>
      ) : (
        <div className="pa-page__list">
          {filtered.map((alert) => {
            const priceDrop =
              alert.currentPrice !== null && alert.currentPriceAtCreation !== null
                ? alert.currentPriceAtCreation - alert.currentPrice
                : 0;
            const priceDown = priceDrop > 0;

            return (
              <article key={alert.id} className="pa-page__card">
                <div className="pa-page__card-info">
                  <Link to={`/book/${alert.bookId}`} className="pa-page__card-book-link">
                    {alert.bookId}
                  </Link>
                  <div className="pa-page__card-prices">
                    {alert.currentPriceAtCreation != null && (
                      <span className="pa-page__card-original">
                        Was {formatPrice(alert.currentPriceAtCreation)}
                      </span>
                    )}
                    {alert.currentPrice != null && (
                      <span className="pa-page__card-current">
                        Now {formatPrice(alert.currentPrice)}
                        {priceDown && (
                          <span className="pa-page__card-drop">
                            ↓ {formatPrice(priceDrop)}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <span className="pa-page__card-target">
                    Target: {formatPrice(alert.targetPrice)}
                  </span>
                  {alert.notified && (
                    <span className="pa-page__card-badge">🎉 Price reached!</span>
                  )}
                </div>

                <div className="pa-page__card-actions">
                  {alert.active && !alert.notified && (
                    <button
                      type="button"
                      className="pa-page__action-btn pa-page__action-btn--pause"
                      onClick={() => handleToggle(alert.id)}
                    >
                      Pause
                    </button>
                  )}
                  {!alert.active && !alert.notified && (
                    <button
                      type="button"
                      className="pa-page__action-btn pa-page__action-btn--resume"
                      onClick={() => handleToggle(alert.id)}
                    >
                      Resume
                    </button>
                  )}
                  <button
                    type="button"
                    className="pa-page__action-btn pa-page__action-btn--delete"
                    onClick={() => handleDelete(alert.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
