import './RatingBreakdown.css';

/**
 * RatingBreakdown — the distribution of star ratings for a book, five rows
 * labelled 5 down to 1, each with a bar and a count.
 *
 * The component's whole job is to answer a question the average cannot: is
 * this 4.2 made of consistent fours, or of fives and ones? That answer lives
 * in the numbers, so the numbers have to be reachable.
 *
 * They were not. The container carried `role="img"` with
 * `aria-label="Rating distribution"`, which tells assistive technology to
 * treat the entire subtree as one graphic and to substitute that label for
 * everything inside it. Every star level, every count and every percentage —
 * all of them real text in the DOM — became unreachable, and a screen reader
 * user got "Rating distribution, image" and nothing else. The label is static
 * too, so there was no fallback: it says the same thing for a book with four
 * hundred reviews as for one with two.
 *
 * `role="img"` is for a graphic whose meaning cannot be expressed in the
 * markup — an SVG glyph, a sparkline drawn in canvas. It is not for a list of
 * numbers. This is a list of numbers, so it is a list now: each row carries
 * one plain sentence for a screen reader, and the bar beside it is marked
 * decorative, because a coloured rectangle adds nothing to "10 reviews, 50
 * per cent" once that has been said.
 */
export default function RatingBreakdown({ breakdown = [], totalReviews = 0 }) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    return null;
  }

  /*
   * Percentages are of the total, so a total that does not match the rows
   * would produce percentages that do not add up. The caller's figure is
   * trusted when it is usable and the rows are summed when it is not, rather
   * than dividing by a zero and rendering five 0% rows under a chart that
   * plainly has bars in it.
   */
  const rowTotal = breakdown.reduce(
    (sum, entry) => sum + (Number(entry?.count) || 0),
    0
  );
  const total = Number(totalReviews) > 0 ? Number(totalReviews) : rowTotal;

  return (
    <ul className="rating-breakdown">
      {breakdown.map(({ star, count }) => {
        const reviews = Number(count) || 0;
        const pct = total > 0 ? Math.round((reviews / total) * 100) : 0;

        /*
         * The bar and the number next to it measure the same thing.
         *
         * The fill used to be `count / maxCount`, so the tallest bar was
         * always drawn full width while the text beside it read
         * `count / totalReviews`. On a book with 10 five-star reviews out of
         * 20, the 5★ bar was full and labelled 50%.
         */
        const width = total > 0 ? (reviews / total) * 100 : 0;

        return (
          <li key={star} className="rating-breakdown__row">
            <span className="rating-breakdown__sr-only">
              {`${star} ${star === 1 ? 'star' : 'stars'}: `}
              {`${reviews} ${reviews === 1 ? 'review' : 'reviews'}, ${pct}%`}
            </span>

            <span className="rating-breakdown__label" aria-hidden="true">
              {star} ★
            </span>
            <span className="rating-breakdown__track" aria-hidden="true">
              <span
                className="rating-breakdown__fill"
                style={{ width: `${width}%` }}
              />
            </span>
            <span className="rating-breakdown__count" aria-hidden="true">
              {reviews}
              <span className="rating-breakdown__pct"> ({pct}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
