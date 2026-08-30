import { useState, useEffect, useCallback } from 'react';

import ReviewCard from './ReviewCard.jsx';
import ReviewSummary from './ReviewSummary.jsx';
import { getBookReviews, getReviewBreakdown, markReviewHelpful } from '../services/reviewService.js';

/**
 * ReviewList — fetches and renders the full review section for a book:
 *   1. Summary card (average + breakdown)
 *   2. Sort toggle (newest / most helpful)
 *   3. Paginated review cards
 *   4. Empty state when there are no reviews yet
 */
export default function ReviewList({ bookId, currentUserId }) {
  const [reviews, setReviews] = useState([]);
  const [breakdownData, setBreakdownData] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const LIMIT = 5;

  const fetchReviews = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    setError('');

    try {
      const [reviewsData, breakdownResult] = await Promise.all([
        getBookReviews(bookId, { page, limit: LIMIT, sort }),
        page === 1 ? getReviewBreakdown(bookId) : null,
      ]);

      setReviews(reviewsData.reviews || []);
      setTotalPages(reviewsData.totalPages || 1);
      setTotalReviews(reviewsData.totalReviews || 0);

      if (breakdownResult) {
        setBreakdownData(breakdownResult);
      }
    } catch (err) {
      setError(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [bookId, page, sort]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Reset to page 1 when sort changes.
  useEffect(() => {
    setPage(1);
  }, [sort]);

  const handleHelpful = async (reviewId) => {
    const result = await markReviewHelpful(reviewId);
    // Optimistically update the local review list.
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, helpfulCount: result.helpfulCount || r.helpfulCount + 1 }
          : r
      )
    );
    return result;
  };

  return (
    <section className="review-list" aria-label="Book reviews">
      <div className="review-list__header">
        <h2 className="review-list__title">Customer Reviews</h2>
        <div className="review-list__sort">
          <label htmlFor="review-sort" className="review-list__sort-label">Sort by:</label>
          <select
            id="review-sort"
            className="review-list__sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="helpful">Most Helpful</option>
          </select>
        </div>
      </div>

      {/* Summary — only on page 1 of newest sort */}
      {page === 1 && sort === 'newest' && breakdownData && (
        <ReviewSummary
          averageRating={breakdownData.averageRating}
          totalReviews={breakdownData.totalReviews}
          breakdown={breakdownData.breakdown}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="review-list__loading" aria-busy="true">
          <div className="review-list__skeleton" />
          <div className="review-list__skeleton review-list__skeleton--short" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="review-list__error">
          <p>{error}</p>
          <button type="button" className="review-list__retry" onClick={fetchReviews}>
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && reviews.length === 0 && (
        <div className="review-list__empty">
          <p>No reviews yet. Be the first to share your thoughts!</p>
        </div>
      )}

      {/* Reviews */}
      {!loading && !error && reviews.length > 0 && (
        <>
          <div className="review-list__cards">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                currentUserId={currentUserId}
                onHelpful={handleHelpful}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="review-list__pagination" aria-label="Review pages">
              <button
                type="button"
                className="review-list__page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ← Previous
              </button>
              <span className="review-list__page-info">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="review-list__page-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
