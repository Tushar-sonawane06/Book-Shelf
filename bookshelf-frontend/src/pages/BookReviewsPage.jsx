import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBookById } from '../services/bookService.js';
import { createReview, updateReview, deleteReview, getMyReviewForBook, toggleHelpful } from '../services/reviewService.js';
import { useAuth } from '../context/AuthContext.jsx';
import StarRating from '../components/StarRating.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import ReviewList from '../components/ReviewList.jsx';
import './BookReviewsPage.css';

/**
 * Full-page view for a book's reviews.
 *
 * Shows the book header, aggregate rating summary, a write/edit review form,
 * and the paginated review list. The form is only shown to authenticated
 * users who haven't already reviewed (or who are editing their own).
 */
export default function BookReviewsPage() {
  const { id: bookId } = useParams();
  const { user } = useAuth();

  const [book, setBook] = useState(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [bookError, setBookError] = useState('');

  const [myReview, setMyReview] = useState(null);
  const [hasReview, setHasReview] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formMessage, setFormMessage] = useState('');

  // Load book
  useEffect(() => {
    let cancelled = false;
    setBookLoading(true);
    getBookById(bookId, { signal: AbortSignal.timeout(10000) })
      .then((data) => { if (!cancelled) setBook(data); })
      .catch((err) => { if (!cancelled) setBookError(err?.message || 'Book not found'); })
      .finally(() => { if (!cancelled) setBookLoading(false); });
    return () => { cancelled = true; };
  }, [bookId]);

  // Load user's existing review
  const loadMyReview = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getMyReviewForBook(bookId);
      setHasReview(data.hasReview);
      setMyReview(data.review);
    } catch {
      // Silent — not all users will have a review
    }
  }, [bookId, user]);

  useEffect(() => {
    loadMyReview();
  }, [loadMyReview, refreshKey]);

  // Form handlers
  async function handleSubmit(formData) {
    if (editingReview) {
      await updateReview(editingReview.id, {
        rating: formData.rating,
        title: formData.title,
        body: formData.body,
      });
      setFormMessage('Review updated!');
    } else {
      await createReview(formData);
      setFormMessage('Review submitted! Thank you.');
    }
    setEditingReview(null);
    setShowForm(false);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setFormMessage(''), 4000);
  }

  function handleEdit(review) {
    setEditingReview(review);
    setShowForm(true);
    setFormMessage('');
  }

  async function handleDelete(reviewId) {
    if (!window.confirm('Delete this review? This cannot be undone.')) return;
    await deleteReview(reviewId);
    setFormMessage('Review deleted.');
    setShowForm(false);
    setEditingReview(null);
    setRefreshKey((k) => k + 1);
    loadMyReview();
    setTimeout(() => setFormMessage(''), 4000);
  }

  async function handleHelpfulToggle(reviewId) {
    await toggleHelpful(reviewId);
    setRefreshKey((k) => k + 1);
  }

  function handleWriteClick() {
    setEditingReview(null);
    setShowForm(true);
    setFormMessage('');
  }

  function renderBreakdown(breakdown, total) {
    if (!breakdown || !total) return null;
    return [5, 4, 3, 2, 1].map((star) => {
      const count = breakdown[star] || 0;
      const pct = Math.round((count / total) * 100);
      return (
        <div className="book-reviews__bar-row" key={star}>
          <span className="book-reviews__bar-label">{star} ★</span>
          <div className="book-reviews__bar-track">
            <div className="book-reviews__bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="book-reviews__bar-pct">{pct}%</span>
        </div>
      );
    });
  }

  // Loading / error states
  if (bookLoading) {
    return (
      <main className="book-reviews book-reviews--loading">
        <div className="book-reviews__spinner" />
        <span>Loading…</span>
      </main>
    );
  }

  if (bookError) {
    return (
      <main className="book-reviews book-reviews--error">
        <h2>Could not load book</h2>
        <p>{bookError}</p>
        <Link to="/" className="book-reviews__back-link">← Back to catalogue</Link>
      </main>
    );
  }

  return (
    <main className="book-reviews">
      {/* Book header */}
      <header className="book-reviews__header">
        <Link to={`/book/${bookId}`} className="book-reviews__back-link">← Back to book</Link>
        <div className="book-reviews__book-info">
          {book?.coverImage && (
            <img
              src={book.coverImage}
              alt={book.title}
              className="book-reviews__cover"
            />
          )}
          <div>
            <h1 className="book-reviews__title">{book?.title}</h1>
            <p className="book-reviews__author">by {book?.author}</p>
          </div>
        </div>
      </header>

      {/* Aggregate stats */}
      {stats && stats.totalReviews > 0 && (
        <section className="book-reviews__summary" aria-label="Rating summary">
          <div className="book-reviews__score">
            <span className="book-reviews__score-number">{stats.averageRating.toFixed(1)}</span>
            <StarRating value={Math.round(stats.averageRating)} disabled size="md" label="Average rating" />
            <span className="book-reviews__score-count">
              {stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="book-reviews__breakdown">
            {renderBreakdown(stats.breakdown, stats.totalReviews)}
          </div>
        </section>
      )}

      {/* Form message */}
      {formMessage && (
        <div className="book-reviews__toast" role="status">
          {formMessage}
        </div>
      )}

      {/* Review form */}
      {user && !hasReview && !showForm && (
        <button
          type="button"
          className="book-reviews__write-btn"
          onClick={handleWriteClick}
        >
          ✍️ Write a Review
        </button>
      )}

      {showForm && (
        <ReviewForm
          bookId={bookId}
          existingReview={editingReview}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingReview(null); }}
          bookTitle={book?.title}
        />
      )}

      {/* Review list */}
      <ReviewList
        bookId={bookId}
        currentUserId={user?._id}
        refreshKey={refreshKey}
        onStatsChange={setStats}
        onHelpfulToggle={handleHelpfulToggle}
      />

      {/* Login prompt for guests */}
      {!user && (
        <div className="book-reviews__login-prompt">
          <p>
            <Link to="/login">Log in</Link> to write a review or vote as helpful.
          </p>
        </div>
      )}
    </main>
  );
}
