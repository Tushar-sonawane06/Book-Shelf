import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createAlert,
  checkAlert,
  deleteByBookId,
} from '../services/priceAlertService.js';
import { formatPrice } from '../utils/bookFormat.js';
import './PriceAlertWidget.css';

/**
 * Price alert widget for the book detail page.
 *
 * Shows the current price, an input for the target price, and buttons to
 * create / remove an alert. When an alert is active it shows the target
 * and a pause/remove control.
 */
export default function PriceAlertWidget({ bookId, currentPrice }) {
  const { user } = useAuth();

  const [hasAlert, setHasAlert] = useState(false);
  const [alertData, setAlertData] = useState(null);
  const [targetInput, setTargetInput] = useState('');
  const [loading, setLoading] = useState(Boolean(user));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const flash = useCallback((msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  }, []);

  // Check if alert exists
  useEffect(() => {
    if (!user || !bookId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    checkAlert(bookId)
      .then((data) => {
        if (cancelled) return;
        setHasAlert(data.hasAlert);
        setAlertData(data.alert);
        if (data.alert) {
          setTargetInput(String(data.alert.targetPrice));
        } else if (currentPrice) {
          // Suggest 10% below current price as default target
          const suggested = Math.round(currentPrice * 0.9);
          setTargetInput(String(suggested));
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (currentPrice) {
          setTargetInput(String(Math.round(currentPrice * 0.9)));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [bookId, user, currentPrice]);

  async function handleCreate() {
    const price = Number(targetInput);
    if (!price || price <= 0) {
      flash('Please enter a valid target price');
      return;
    }

    setSaving(true);
    try {
      const data = await createAlert(bookId, price);
      setHasAlert(true);
      setAlertData(data.alert);
      flash(`Alert set for ${formatPrice(price)}`);
    } catch (err) {
      flash(err?.message || 'Failed to set alert');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!alertData) return;
    setSaving(true);
    try {
      await deleteByBookId(bookId);
      setHasAlert(false);
      setAlertData(null);
      flash('Alert removed');
    } catch (err) {
      flash(err?.message || 'Failed to remove alert');
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="price-alert-widget price-alert-widget--logged-out">
        <p>Log in to set a price drop alert.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="price-alert-widget price-alert-widget--loading">
        <span className="price-alert-widget__spinner" />
      </div>
    );
  }

  return (
    <div className="price-alert-widget">
      <h4 className="price-alert-widget__heading">🔔 Price Alert</h4>

      {message && (
        <div className="price-alert-widget__toast" role="status">
          {message}
        </div>
      )}

      {currentPrice && (
        <p className="price-alert-widget__current">
          Current price: <strong>{formatPrice(currentPrice)}</strong>
        </p>
      )}

      {hasAlert && alertData ? (
        <div className="price-alert-widget__active">
          <p className="price-alert-widget__target">
            Alert set for <strong>{formatPrice(alertData.targetPrice)}</strong>
          </p>
          {alertData.notified && (
            <span className="price-alert-widget__badge price-alert-widget__badge--triggered">
              🎉 Price reached!
            </span>
          )}
          <div className="price-alert-widget__controls">
            <button
              type="button"
              className="price-alert-widget__btn price-alert-widget__btn--remove"
              onClick={handleRemove}
              disabled={saving}
            >
              Remove alert
            </button>
          </div>
        </div>
      ) : (
        <div className="price-alert-widget__form">
          <label htmlFor="target-price" className="price-alert-widget__label">
            Notify me when price drops to:
          </label>
          <div className="price-alert-widget__input-row">
            <input
              id="target-price"
              type="number"
              min="1"
              className="price-alert-widget__input"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="Target price"
              disabled={saving}
            />
            <button
              type="button"
              className="price-alert-widget__btn price-alert-widget__btn--create"
              onClick={handleCreate}
              disabled={saving || !targetInput}
            >
              {saving ? 'Saving…' : 'Set alert'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
