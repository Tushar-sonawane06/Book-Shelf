import { useState, useEffect } from 'react';
import { subscribeStockAlert, unsubscribeStockAlert, checkStockAlert } from '../services/stockAlertService.js';
import './StockAlertButton.css';

/**
 * StockAlertButton — shown when a book is out of stock.
 * Lets logged-in users subscribe to a back-in-stock notification.
 */
export default function StockAlertButton({ bookId, isLoggedIn }) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isLoggedIn || !bookId) { setSubscribed(false); return; }
    const c = new AbortController();
    checkStockAlert(bookId, { signal: c.signal })
      .then((data) => { if (!c.signal.aborted) setSubscribed(data.subscribed); })
      .catch(() => {});
    return () => c.abort();
  }, [bookId, isLoggedIn]);

  const handleToggle = async () => {
    if (!isLoggedIn) { setMessage('Please log in to set alerts.'); return; }
    setLoading(true);
    setMessage('');
    try {
      if (subscribed) {
        await unsubscribeStockAlert(bookId);
        setSubscribed(false);
        setMessage('Alert removed.');
      } else {
        await subscribeStockAlert(bookId);
        setSubscribed(true);
        setMessage("You'll be notified when it's back!");
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.message || 'Failed to update alert.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stock-alert">
      <button
        type="button"
        className={`stock-alert__btn ${subscribed ? 'stock-alert__btn--active' : ''}`}
        onClick={handleToggle}
        disabled={loading}
      >
        {loading ? '…' : subscribed ? '🔔 Alert set' : '🔕 Notify when available'}
      </button>
      {message && <span className="stock-alert__msg">{message}</span>}
    </div>
  );
}
