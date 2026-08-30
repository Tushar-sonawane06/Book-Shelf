import { useState, useEffect } from 'react';
import { getTopBooks } from '../services/adminService.js';
import { formatMoney } from '../utils/currency.js';

/*
 * Revenue is formatted by utils/currency.js. It used to be
 * `₹{value.toLocaleString()}` inline: a hardcoded symbol beside grouping taken
 * from the browser's locale rather than the currency's, and a method call that
 * throws outright on a row whose amount came back null.
 */

/**
 * AdminTopBooks — table showing the best-selling books for a given period.
 */
export default function AdminTopBooks() {
  const [books, setBooks] = useState([]);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setError('');

    getTopBooks({ limit: 10, period, signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        setBooks(result.topBooks || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load top books');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [period]);

  return (
    <div className="admin-table-card">
      <div className="admin-table-card__header">
        <h3 className="admin-table-card__title">Top Selling Books</h3>
        <select
          className="admin-table-card__period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {loading && (
        <div className="admin-table-card__loading">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="admin-table-card__skeleton-row" />
          ))}
        </div>
      )}

      {error && <p className="admin-table-card__error">{error}</p>}

      {!loading && !error && books.length === 0 && (
        <p className="admin-table-card__empty">No sales data yet.</p>
      )}

      {!loading && !error && books.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Book</th>
              <th className="admin-table__right">Sold</th>
              <th className="admin-table__right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book, index) => (
              <tr key={book.bookId}>
                <td className="admin-table__rank">{index + 1}</td>
                <td className="admin-table__name">{book.title || book.bookId}</td>
                <td className="admin-table__right">{book.totalSold}</td>
                <td className="admin-table__right">
                  {formatMoney(book.totalRevenue, { minimumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
