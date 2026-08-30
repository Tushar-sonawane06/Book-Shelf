import { useState } from 'react';
import StarRating from './StarRating.jsx';
import './ReviewCard.css';

/**
 * A single review card.
 *
 * Shows the reviewer's avatar/name, star rating, title, body text, helpful
 * count, and a verified-purchase badge when applicable. Owners see edit and
 * delete buttons; authenticated non-owners see a "Helpful" toggle.
 */
export default function ReviewCard({
  review,
  currentUserId,
  onHelpfulToggle,
  onEdit,
  onDelete,
}) {
  const [helpfulBusy, setHelpfulBusy] = useState(false);
  const isOwner = currentUserId && review.userId === currentUserId;

  async function handleHelpful() {
    if (helpfulBusy || !onHelpfulToggle) return;
    setHelpfulBusy(true);
    try {
      await onHelpfulToggle(review.id);
    } finally {
      setHelpfulBusy(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <article className="review-card" aria-label={`Review by ${review.userName}`}>
      <header className="review-card__header">
        <div className="review-card__avatar" aria-hidden="true">
          {review.userAvatar || '📚'}
        </div>
        <div className="review-card__meta">
          <span className="review-card__name">{review.userName}</span>
          {review.verifiedPurchase && (
            <span className="review-card__badge review-card__badge--verified">
              ✓ Verified Purchase
            </span>
          )}
          <span className="review-card__date">{formatDate(review.createdAt)}</span>
        </div>
      </header>

      <div className="review-card__rating">
        <StarRating value={review.rating} disabled size="sm" label={`Rating: ${review.rating} out of 5`} />
      </div>

      {review.title && <h4 className="review-card__title">{review.title}</h4>}

      {review.body && <p className="review-card__body">{review.body}</p>}

      <footer className="review-card__footer">
        {!isOwner && currentUserId && (
          <button
            type="button"
            className={`review-card__helpful-btn ${review.userHasVotedHelpful ? 'review-card__helpful-btn--active' : ''}`}
            onClick={handleHelpful}
            disabled={helpfulBusy}
            aria-pressed={review.userHasVotedHelpful}
          >
            👍 Helpful ({review.helpfulCount || 0})
          </button>
        )}

        {isOwner && (
          <div className="review-card__actions">
            <button
              type="button"
              className="review-card__action-btn review-card__action-btn--edit"
              onClick={() => onEdit?.(review)}
            >
              ✏️ Edit
            </button>
            <button
              type="button"
              className="review-card__action-btn review-card__action-btn--delete"
              onClick={() => onDelete?.(review.id)}
            >
              🗑️ Delete
            </button>
          </div>
        )}

        {!isOwner && !currentUserId && (
          <span className="review-card__helpful-count">
            👍 {review.helpfulCount || 0} found this helpful
          </span>
        )}
      </footer>
    </article>
  );
}
