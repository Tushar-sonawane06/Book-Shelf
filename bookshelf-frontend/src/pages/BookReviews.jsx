import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import ReviewCard from '../components/ReviewCard.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useBook } from '../hooks/useBook.js';
import {
  getReviews,
  getReviewStats,
  submitReview,
  deleteReview,
  toggleHelpful,
} from '../services/reviewService.js';
import './BookReviews.css';

/**
 * Full-page view of reviews for a single book.
 *
 * Shows a rating overview (average + star-distribution bars), the review
 * form (for logged-in users), and a paginated list of reviews with sort
 * controls. The book detail page can link here for a dedicated reviews view.
 */
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
  { value: 'helpful', label: 'Most helpful' },
];

export default function BookReviews() {
  const { id: bookId } = useParams();
  const { book, loading: bookLoading } = useBook(bookId);
  const auth = useAuth() ?? {};
  const { isAuthenticated = false, user = null } = auth;

  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ average: 0, total: 0, breakdown: {} });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const abortRef = useRef(null);

  const fetchReviews = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');

    try {
      const [reviewData, statsData] = await Promise.all([
        getReviews(bookId, { page, limit: 10, sort }, { signal: controller.signal }),
        getReviewStats(bookId, { signal: controller.signal }),
      ]);

      setReviews(reviewData.reviews);
      setTotalPages(reviewData.totalPages);
      setTotal(reviewData.total);
      setStats(statsData);
    } catch (err) {
      if (err?.code !== 'ABORT_ERR' && err?.name !== 'CanceledError') {
        setError('Failed to load reviews. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [bookId, page, sort]);

  useEffect(() => {
    if (bookId) {
      fetchReviews();
    }

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchReviews, bookId]);

  // Reset to page 1 when sort changes.
  useEffect(() => {
    setPage(1);
  }, [sort]);

  const handleSubmit = useCallback(
    async ({ rating, title, body }) => {
      await submitReview(bookId, { rating, title, body });
      // Reload the list from page 1 to show the new/updated review.
      setPage(1);
      setSort('newest');
      // Give the server a moment to index the aggregate.
      setTimeout(fetchReviews, 300);
    },
    [bookId, fetchReviews]
  );

  const handleDelete = useCallback(
    async (reviewId) => {
      await deleteReview(reviewId);
      fetchReviews();
    },
    [fetchReviews]
  );

  const handleHelpfulToggle = useCallback(
    async (reviewId) => {
      return toggleHelpful(reviewId);
    },
    []
  );

  const maxBreakdown = Math.max(...Object.values(stats.breakdown), 1);

  if (bookLoading) {
    return (
      <main className="book-reviews-page">
        <div className="book-reviews-loading">Loading…</div>
      </main>
    );
  }

  if (!book) {
    return (
      <main className="book-reviews-page">
        <div className="book-reviews-empty">
          <h2>Book not found</h2>
          <Link to="/" className="book-reviews-back">Return to Catalog</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="book-reviews-page">
      <div className="book-reviews-container">
        <Link to={`/book/${bookId}`} className="book-reviews-back">
          ← Back to {book.title}
        </Link>

        <h1 className="book-reviews-heading">
          Reviews for <em>{book.title}</em>
        </h1>

        {/* Rating overview */}
        <section className="book-reviews-overview">
          <div className="book-reviews-overview__score">
            <span className="book-reviews-overview__average">{stats.average}</span>
            <span className="book-reviews-overview__label">
              out of 5 · {stats.total} review{stats.total !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="book-reviews-overview__breakdown">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.breakdown[star] || 0;
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;

              return (
                <div key={star} className="book-reviews-breakdown__row">
                  <span className="book-reviews-breakdown__label">{star} ★</span>
                  <div className="book-reviews-breakdown__bar-track">
                    <div
                      className="book-reviews-breakdown__bar-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="book-reviews-breakdown__count">{count}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Review form (logged-in users only) */}
        {isAuthenticated ? (
          <ReviewForm onSubmit={handleSubmit} />
        ) : (
          <div className="book-reviews-login-prompt">
            <Link to="/login">Log in</Link> to write a review.
          </div>
        )}

        {/* Sort controls */}
        <div className="book-reviews-controls">
          <label className="book-reviews-sort-label" htmlFor="reviews-sort">
            Sort by
          </label>
          <select
            id="reviews-sort"
            className="book-reviews-sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="book-reviews-count">
            {total} review{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Review list */}
        {error && (
          <div className="book-reviews-error">
            <p>{error}</p>
            <button type="button" onClick={fetchReviews}>
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="book-reviews-loading">Loading reviews…</div>
        ) : reviews.length === 0 ? (
          <div className="book-reviews-empty-state">
            <p>No reviews yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          <>
            <div className="book-reviews-list">
              {reviews.map((review) => (
                <ReviewCard
                  key={review._id}
                  review={review}
                  currentUserId={user?._id}
                  onHelpfulToggle={handleHelpfulToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="book-reviews-pagination" aria-label="Review pages">
                <button
                  type="button"
                  className="book-reviews-page-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  ← Previous
                </button>
                <span className="book-reviews-page-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="book-reviews-page-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next →
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
