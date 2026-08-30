import { useState, useEffect, useCallback } from 'react';
import ReviewCard from './ReviewCard.jsx';
import './ReviewList.css';

/**
 * Paginated, sortable list of reviews for a book.
 *
 * Fetches pages from the review service and renders them as ReviewCards.
 * Sort controls are tabs along the top. The component calls back to the
 * parent whenever the aggregate stats change (e.g. after a helpful vote
 * updates the count) so the summary section stays in sync.
 */
export default function ReviewList({
  bookId,
  currentUserId,
  onStatsChange,
  refreshKey = 0,
  onHelpfulToggle,
}) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReviews = useCallback(async (page = 1, sortKey = sort) => {
    setLoading(true);
    setError('');
    try {
      const mod = await import('../services/reviewService.js');
      const data = await mod.getBookReviews(bookId, { page, limit: 10, sort: sortKey });
      setReviews(data.reviews || []);
      setStats(data.stats || null);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      if (data.stats && onStatsChange) onStatsChange(data.stats);
    } catch (err) {
      setError(err?.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [bookId, sort, onStatsChange]);

  useEffect(() => {
    loadReviews(1, sort);
  }, [bookId, sort, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSortChange(newSort) {
    setSort(newSort);
  }

  function handlePageChange(page) {
    loadReviews(page, sort);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const sortOptions = [
    { key: 'newest', label: 'Newest' },
    { key: 'oldest', label: 'Oldest' },
    { key: 'highest', label: 'Highest' },
    { key: 'lowest', label: 'Lowest' },
    { key: 'helpful', label: 'Most Helpful' },
  ];

  return (
    <section className="review-list" aria-label="Book reviews">
      {/* Sort tabs */}
      <div className="review-list__toolbar">
        <span className="review-list__count">
          {pagination.total} review{pagination.total !== 1 ? 's' : ''}
        </span>
        <div className="review-list__sort-tabs" role="tablist" aria-label="Sort reviews">
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={sort === opt.key}
              className={`review-list__sort-tab ${sort === opt.key ? 'review-list__sort-tab--active' : ''}`}
              onClick={() => handleSortChange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="review-list__loading">
          <div className="review-list__spinner" />
          <span>Loading reviews…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="review-list__error" role="alert">
          {error}
          <button type="button" onClick={() => loadReviews(pagination.page, sort)}>
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && reviews.length === 0 && (
        <div className="review-list__empty">
          <span className="review-list__empty-icon">📝</span>
          <p>No reviews yet. Be the first to share your thoughts!</p>
        </div>
      )}

      {/* Reviews */}
      {!loading && !error && reviews.length > 0 && (
        <div className="review-list__items">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={currentUserId}
              onHelpfulToggle={onHelpfulToggle}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <nav className="review-list__pagination" aria-label="Review pages">
          <button
            type="button"
            className="review-list__page-btn"
            disabled={pagination.page <= 1}
            onClick={() => handlePageChange(pagination.page - 1)}
            aria-label="Previous page"
          >
            ← Prev
          </button>
          <span className="review-list__page-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="review-list__page-btn"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
            aria-label="Next page"
          >
            Next →
          </button>
        </nav>
      )}
    </section>
  );
}
