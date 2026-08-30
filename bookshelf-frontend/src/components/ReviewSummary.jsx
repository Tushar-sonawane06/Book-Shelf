import RatingBreakdown from './RatingBreakdown.jsx';

/**
 * ReviewSummary — the overview card that sits above the review list.
 *
 * Displays the large average rating, star icons, total review count, and a
 * RatingBreakdown showing the distribution.  Rendered only when there is at
 * least one review; an empty state is handled by the parent.
 */
export default function ReviewSummary({ averageRating = 0, totalReviews = 0, breakdown = [] }) {
  if (totalReviews === 0) {
    return null;
  }

  const fullStars = Math.floor(averageRating);
  const hasHalf = averageRating - fullStars >= 0.5;

  return (
    <div className="review-summary">
      <div className="review-summary__left">
        <span className="review-summary__average">{averageRating.toFixed(1)}</span>
        <div className="review-summary__stars" aria-label={`${averageRating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={
                `review-summary__star ${
                  star <= fullStars
                    ? 'review-summary__star--filled'
                    : star === fullStars + 1 && hasHalf
                      ? 'review-summary__star--half'
                      : ''
                }`
              }
            >
              ★
            </span>
          ))}
        </div>
        <span className="review-summary__total">
          {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
        </span>
      </div>

      <div className="review-summary__right">
        <RatingBreakdown breakdown={breakdown} totalReviews={totalReviews} />
      </div>
    </div>
  );
}
