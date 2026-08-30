import { useState } from 'react';

/**
 * A single review card rendered in the review list.
 *
 * Shows the reviewer's display name (or "Anonymous"), star rating, title,
 * body, verified-purchase badge, helpful count, and a "Helpful" button.
 */
export default function ReviewCard({ review, currentUserId, onHelpful }) {
  const [helpfulLoading, setHelpfulLoading] = useState(false);
  const [localHelpful, setLocalHelpful] = useState(false);

  if (!review) return null;

  const isOwn = currentUserId && review.userId === currentUserId;
  const dateStr = new Date(review.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleHelpful = async () => {
    if (helpfulLoading || localHelpful || isOwn) return;
    setHelpfulLoading(true);
    try {
      await onHelpful(review.id);
      setLocalHelpful(true);
    } catch {
      // Silently ignore — a failed helpful vote is cosmetic, not critical.
    } finally {
      setHelpfulLoading(false);
    }
  };

  return (
    <div className="review-card">
      <div className="review-card__header">
        <div className="review-card__stars" aria-label={`${review.rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star} className={`review-card__star ${star <= review.rating ? 'review-card__star--filled' : ''}`}>
              ★
            </span>
          ))}
        </div>
        <span className="review-card__date">{dateStr}</span>
      </div>

      {review.title && <h4 className="review-card__title">{review.title}</h4>}

      {review.body && <p className="review-card__body">{review.body}</p>}

      <div className="review-card__footer">
        <span className="review-card__author">
          {review.userName || 'Anonymous'}
        </span>

        {review.verifiedPurchase && (
          <span className="review-card__badge review-card__badge--verified">
            ✓ Verified Purchase
          </span>
        )}

        {!isOwn && (
          <button
            type="button"
            className={`review-card__helpful ${localHelpful ? 'review-card__helpful--active' : ''}`}
            onClick={handleHelpful}
            disabled={helpfulLoading || localHelpful}
          >
            👍 Helpful {review.helpfulCount > 0 && `(${review.helpfulCount + (localHelpful ? 1 : 0)})`}
          </button>
        )}
      </div>
    </div>
  );
}
