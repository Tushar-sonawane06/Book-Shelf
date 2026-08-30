import { useCallback, useState } from 'react';
import './ReviewCard.css';

/**
 * Display a single review.
 *
 * The card shows the reviewer's name (or "Anonymous" when the user has been
 * deleted), a star rating, an optional title, the body text, and the helpful
 * vote count. Verified purchasers get a badge so readers can weigh their
 * opinion differently.
 *
 * If `currentUserId` matches the review author the delete button is shown.
 */
export default function ReviewCard({
  review,
  currentUserId = null,
  onHelpfulToggle = null,
  onDelete = null,
}) {
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount || 0);
  const [hasVoted, setHasVoted] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = currentUserId && review.user?._id === currentUserId;

  const handleHelpful = useCallback(async () => {
    if (!onHelpfulToggle) return;

    try {
      const result = await onHelpfulToggle(review._id);
      if (result) {
        setHelpfulCount(result.helpfulCount);
        setHasVoted(result.voted);
      }
    } catch {
      // Optimistic revert is not needed; the count is the source of truth.
    }
  }, [onHelpfulToggle, review._id]);

  const handleDelete = useCallback(async () => {
    if (!onDelete || deleting) return;

    if (!window.confirm('Delete this review?')) return;

    setDeleting(true);

    try {
      await onDelete(review._id);
    } catch {
      setDeleting(false);
    }
  }, [onDelete, deleting, review._id]);

  const userName = review.user?.name || 'Anonymous';
  const initials = userName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const dateStr = new Date(review.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const isEdited =
    review.editedAt && review.editedAt !== review.createdAt;

  return (
    <article className="review-card">
      <div className="review-card__header">
        <div className="review-card__avatar" aria-hidden="true">
          {review.user?.avatar ? (
            <img src={review.user.avatar} alt="" className="review-card__avatar-img" />
          ) : (
            <span className="review-card__avatar-initials">{initials}</span>
          )}
        </div>

        <div className="review-card__meta">
          <span className="review-card__author">{userName}</span>
          <div className="review-card__rating-date">
            <span className="review-card__stars" aria-label={`${review.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={`review-card__star ${i < review.rating ? 'review-card__star--filled' : ''}`}
                >
                  ★
                </span>
              ))}
            </span>
            <time className="review-card__date" dateTime={review.createdAt}>
              {dateStr}
            </time>
            {isEdited && (
              <span className="review-card__edited" title={`Edited ${new Date(review.editedAt).toLocaleDateString()}`}>
                (edited)
              </span>
            )}
          </div>
        </div>

        {review.verifiedPurchase && (
          <span className="review-card__verified" title="Verified purchase">
            ✓ Verified
          </span>
        )}
      </div>

      {review.title && (
        <h4 className="review-card__title">{review.title}</h4>
      )}

      {review.body && (
        <p className="review-card__body">{review.body}</p>
      )}

      <div className="review-card__footer">
        <button
          type="button"
          className={`review-card__helpful-btn ${hasVoted ? 'review-card__helpful-btn--active' : ''}`}
          onClick={handleHelpful}
          disabled={!onHelpfulToggle}
          aria-label={`Mark as helpful (${helpfulCount} votes)`}
        >
          👍 Helpful
          {helpfulCount > 0 && (
            <span className="review-card__helpful-count">{helpfulCount}</span>
          )}
        </button>

        {isOwner && (
          <button
            type="button"
            className="review-card__delete-btn"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </article>
  );
}
