import { useState, useCallback, useEffect } from 'react';
import './ReviewForm.css';

/**
 * Form for writing or editing a book review.
 *
 * The rating is the only required field. Title and body are optional. On
 * submit the form calls `onSubmit` (which should POST to the API) and
 * resets itself on success. If the parent passes an `initial` value the
 * form is pre-populated for editing.
 */
export default function ReviewForm({
  onSubmit,
  initial = null,
  disabled = false,
}) {
  const [rating, setRating] = useState(initial?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset when the initial values change (e.g. navigating to a different book).
  useEffect(() => {
    setRating(initial?.rating || 0);
    setTitle(initial?.title || '');
    setBody(initial?.body || '');
    setError('');
    setSuccess('');
  }, [initial?.rating, initial?.title, initial?.body]);

  const clearSuccess = useCallback(() => setSuccess(''), []);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(clearSuccess, 4000);
    return () => clearTimeout(timer);
  }, [success, clearSuccess]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (rating === 0) {
        setError('Please select a star rating.');
        return;
      }

      setError('');
      setSubmitting(true);

      try {
        await onSubmit({ rating, title: title.trim(), body: body.trim() });
        setSuccess('Your review has been saved!');
        // Don't clear fields on edit — keep the values visible.
        if (!initial) {
          setRating(0);
          setTitle('');
          setBody('');
        }
      } catch (err) {
        setError(err?.message || 'Something went wrong. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [rating, title, body, onSubmit, initial]
  );

  const displayRating = hoverRating || rating;

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <h3 className="review-form__heading">
        {initial ? 'Edit your review' : 'Write a review'}
      </h3>

      {/* Star selector */}
      <div className="review-form__stars" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`review-form__star ${
              star <= displayRating ? 'review-form__star--active' : ''
            }`}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            disabled={disabled || submitting}
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <span className="review-form__rating-label">
            {rating}/5
          </span>
        )}
      </div>

      <input
        className="review-form__title-input"
        type="text"
        placeholder="Review title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        disabled={disabled || submitting}
      />

      <textarea
        className="review-form__body"
        placeholder="What did you like or dislike? How was the writing style?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={2000}
        disabled={disabled || submitting}
      />

      <div className="review-form__footer">
        <span className="review-form__char-count">
          {body.length}/2000
        </span>

        {error && <p className="review-form__error">{error}</p>}
        {success && <p className="review-form__success">{success}</p>}

        <button
          type="submit"
          className="review-form__submit"
          disabled={disabled || submitting}
        >
          {submitting ? 'Saving…' : initial ? 'Update Review' : 'Submit Review'}
        </button>
      </div>
    </form>
  );
}
