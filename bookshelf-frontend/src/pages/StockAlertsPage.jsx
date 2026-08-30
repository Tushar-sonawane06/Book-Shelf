import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import api from '../utils/api.js';
import { unsubscribeStockAlert } from '../services/stockAlertService.js';
import { useBooksByIds, isCanceled } from '../hooks/useBooksByIds.js';
import { usePageMetadata } from '../hooks/usePageMetadata.js';
import { describeApiError } from '../utils/apiError.js';
import { formatMoney } from '../utils/currency.js';
import './StockAlertsPage.css';

/**
 * StockAlertsPage — the books the current user is waiting to come back in
 * stock.
 *
 * The page used to render
 *
 *     {alert.bookTitle || alert.bookId}
 *
 * and there is no `bookTitle` anywhere in the system. `models/StockAlert.js`
 * stores `userId`, `bookId`, `notified` and `notifiedAt`, and `getMyAlerts`
 * returns those documents unchanged. So the `||` never took its left branch:
 * every row showed a raw catalogue id — `b3`, `b7` — on a page whose entire
 * purpose is to name the books somebody is waiting for. The fallback read
 * like a defence against a rare case and was in fact the only branch that
 * ever ran. See #422.
 *
 * The ids are resolved against the catalogue instead, through the same
 * `useBooksByIds` the wishlist (#328) and Recently Viewed (#336) use. This is
 * the third page with this bug and the last one that was still doing it by
 * hand.
 */

/**
 * The alert list.
 *
 * Left as a local function rather than moved into services/stockAlertService.js
 * — it is the only caller, and adding it to the service would be a second
 * place to look for the same request.
 */
async function getMyAlerts({ signal } = {}) {
  const response = await api.get('/stock-alerts/mine', { signal });
  return response.data;
}

/**
 * A subscribe date that cannot render "Invalid Date".
 *
 * `new Date(undefined).toLocaleDateString()` produces exactly that string,
 * and an alert document with no `createdAt` reaches this unguarded. Saying
 * nothing is better than saying something wrong.
 */
function formatSubscribedOn(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

export default function StockAlertsPage() {
  /*
   * The page had no title, so the browser tab kept whatever the previous
   * route set. See #337 for the rest of them.
   */
  usePageMetadata({
    title: 'Your stock alerts',
    description: 'The books you asked to be told about when they are back in stock.',
  });

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /*
   * Which rows have a removal in flight, and which rows failed.
   *
   * Two pieces of state rather than one status per row: a row that failed and
   * is being retried is in both, and collapsing them would make the retry
   * clear the error it is retrying before the retry has finished.
   */
  const [removing, setRemoving] = useState(() => new Set());
  const [rowErrors, setRowErrors] = useState({});

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);

    getMyAlerts({ signal: controller.signal })
      .then((data) => {
        setAlerts(Array.isArray(data) ? data : data?.alerts ?? []);
        setLoading(false);
      })
      .catch((err) => {
        // An abort is not a failure — the page is unmounting. Rendering it
        // would flash "canceled" into the error slot.
        if (isCanceled(err)) {
          return;
        }

        setError(describeApiError(err, 'Failed to load your stock alerts.'));
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  /*
   * Memoised on the joined ids, not on `alerts`. `alerts` gets a new array
   * identity every time a row is removed, and `useBooksByIds` keys its effect
   * on the ids it is given — handing it a fresh array on every render would
   * refetch the catalogue continuously.
   */
  const alertIdKey = alerts.map((alert) => alert.bookId).join(',');
  const bookIds = useMemo(
    () => (alertIdKey === '' ? [] : alertIdKey.split(',')),
    [alertIdKey]
  );

  /*
   * Held in its loading state until the alerts themselves have arrived.
   * Resolving the empty interim list would flash "no alerts yet" at someone
   * who has several.
   */
  const {
    books,
    missingIds,
    loading: booksLoading,
  } = useBooksByIds(bookIds, { enabled: !loading });

  const booksById = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books]
  );

  /*
   * `missingIds` is "the catalogue answered 404" — the book has been
   * delisted, which is worth telling the customer because an alert for it
   * will never fire. That is a different thing from `failedIds`, a request
   * that did not complete: saying "no longer available" about a book behind a
   * flaky network would be a lie told by the network.
   */
  const missing = useMemo(() => new Set(missingIds), [missingIds]);

  const handleRemove = useCallback(async (bookId) => {
    setRemoving((previous) => new Set(previous).add(bookId));
    setRowErrors((previous) => {
      if (!previous[bookId]) return previous;
      const next = { ...previous };
      delete next[bookId];
      return next;
    });

    try {
      await unsubscribeStockAlert(bookId);
      setAlerts((previous) => previous.filter((alert) => alert.bookId !== bookId));
    } catch (err) {
      /*
       * Reported on the row, not in the banner at the top of the page. The
       * banner is a long way from the button that was pressed, and with
       * several alerts on screen it does not say which one failed.
       */
      setRowErrors((previous) => ({
        ...previous,
        [bookId]: describeApiError(err, 'Could not remove this alert.'),
      }));
    } finally {
      setRemoving((previous) => {
        const next = new Set(previous);
        next.delete(bookId);
        return next;
      });
    }
  }, []);

  const busy = loading || booksLoading;

  return (
    <main className="alerts-page">
      <h1 className="alerts-page__title">My Stock Alerts</h1>
      <p className="alerts-page__subtitle">Books you're waiting to come back in stock.</p>

      {error && (
        <div className="alerts-page__error" role="alert">
          {error}
          <button type="button" onClick={() => setError('')} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {busy && (
        <div className="alerts-page__loading" aria-busy="true">
          {[1, 2, 3].map((i) => <div key={i} className="alerts-page__skeleton" />)}
        </div>
      )}

      {!busy && alerts.length === 0 && (
        <div className="alerts-page__empty">
          <p>You don't have any stock alerts yet.</p>
          <Link to="/" className="alerts-page__browse">Browse books</Link>
        </div>
      )}

      {!busy && alerts.length > 0 && (
        <ul className="alerts-page__list">
          {alerts.map((alert) => {
            const book = booksById.get(alert.bookId);
            const isMissing = missing.has(alert.bookId);
            const subscribedOn = formatSubscribedOn(alert.createdAt);
            const isRemoving = removing.has(alert.bookId);

            return (
              <li key={alert.bookId} className="alerts-page__item">
                {/*
                  The cover is a colour in this catalogue, not an image — the
                  same thing BookCard renders. A book that is missing gets no
                  swatch rather than a black one from an undefined value.
                */}
                {book && (
                  <span
                    className="alerts-page__cover"
                    style={{ background: book.cover }}
                    aria-hidden="true"
                  />
                )}

                <div className="alerts-page__info">
                  {book ? (
                    <>
                      <Link
                        to={`/book/${alert.bookId}`}
                        className="alerts-page__book-link"
                      >
                        {book.title}
                      </Link>
                      {book.author && (
                        <span className="alerts-page__author">{book.author}</span>
                      )}
                      {typeof book.price === 'number' && (
                        <span className="alerts-page__price">
                          {formatMoney(book.price)}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {/*
                        The id is still shown, because it is the only thing
                        known about this book — but with a sentence saying
                        why, rather than as a bare "b3" that reads like a
                        rendering fault.
                      */}
                      <span className="alerts-page__book-link alerts-page__book-link--missing">
                        {alert.bookId}
                      </span>
                      <span className="alerts-page__unavailable">
                        {isMissing
                          ? 'No longer in the catalogue — this alert will not arrive.'
                          : 'Details could not be loaded.'}
                      </span>
                    </>
                  )}

                  {subscribedOn && (
                    <span className="alerts-page__date">Subscribed {subscribedOn}</span>
                  )}

                  {rowErrors[alert.bookId] && (
                    <span className="alerts-page__row-error" role="alert">
                      {rowErrors[alert.bookId]}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="alerts-page__remove"
                  onClick={() => handleRemove(alert.bookId)}
                  /*
                   * Disabled while its own request is in flight. Two clicks
                   * sent two DELETEs, and the second answered 404 — which
                   * surfaced as an error about an alert that had just been
                   * removed successfully.
                   */
                  disabled={isRemoving}
                  aria-label={
                    book ? `Remove stock alert for ${book.title}` : 'Remove stock alert'
                  }
                >
                  {isRemoving ? 'Removing…' : 'Remove'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
