import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import RatingBreakdown from './RatingBreakdown.jsx';

/**
 * RatingBreakdown — the star distribution.
 *
 * The queries here are all scoped to a row. The previous version asked for
 * `getByText(/3/)` and `getByText(/10/)` and called it "shows count for each
 * star level"; with the fixture below, `/3/` matches three different nodes —
 * the `3 ★` label, the count `3`, and the `(30%)` on the 4★ row — so the test
 * failed outright. An unanchored single digit cannot tell a star level from a
 * count from a percentage, so even where it passed it was not checking what
 * its name claimed. `/6/` found the 4★ count only by luck of which digits
 * happened to appear elsewhere.
 */

const sampleBreakdown = [
  { star: 5, count: 10 },
  { star: 4, count: 6 },
  { star: 3, count: 3 },
  { star: 2, count: 1 },
  { star: 1, count: 0 },
];

/**
 * The row for a star level, found by the sentence a screen reader reads.
 *
 * That sentence is real text, positioned off-screen, rather than an
 * aria-label: a <li> takes its accessible name from the author, not from its
 * content, so a label would have to be an attribute — and off-screen text is
 * announced more consistently across screen readers than aria-label is.
 */
function rowFor(star) {
  const label = screen.getByText(new RegExp(`^${star} stars?:`));
  return label.closest('li');
}

/** What that row says, with the whitespace normalised. */
function announcementFor(star) {
  return screen.getByText(new RegExp(`^${star} stars?:`)).textContent.trim();
}

describe('RatingBreakdown', () => {
  it('renders all five star rows', () => {
    render(<RatingBreakdown breakdown={sampleBreakdown} totalReviews={20} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    for (const star of [5, 4, 3, 2, 1]) {
      expect(screen.getByText(`${star} ★`)).toBeInTheDocument();
    }
  });

  it('shows the count for each star level', () => {
    render(<RatingBreakdown breakdown={sampleBreakdown} totalReviews={20} />);

    // Scoped to the row, so `3` is unambiguously the 3★ count.
    expect(within(rowFor(5)).getByText('10')).toBeInTheDocument();
    expect(within(rowFor(4)).getByText('6')).toBeInTheDocument();
    expect(within(rowFor(3)).getByText('3')).toBeInTheDocument();
    expect(within(rowFor(2)).getByText('1')).toBeInTheDocument();
    expect(within(rowFor(1)).getByText('0')).toBeInTheDocument();
  });

  it('shows each level as a percentage of the total', () => {
    render(<RatingBreakdown breakdown={sampleBreakdown} totalReviews={20} />);

    expect(within(rowFor(5)).getByText('(50%)')).toBeInTheDocument();
    expect(within(rowFor(4)).getByText('(30%)')).toBeInTheDocument();
    expect(within(rowFor(3)).getByText('(15%)')).toBeInTheDocument();
    expect(within(rowFor(1)).getByText('(0%)')).toBeInTheDocument();
  });

  it('renders nothing for an empty breakdown', () => {
    const { container } = render(
      <RatingBreakdown breakdown={[]} totalReviews={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when breakdown is undefined', () => {
    const { container } = render(
      <RatingBreakdown breakdown={undefined} totalReviews={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  describe('what a screen reader gets', () => {
    it('reads the numbers, not just a title', () => {
      // role="img" on the container used to collapse the whole subtree into
      // one graphic labelled "Rating distribution", and every count and
      // percentage in it became unreachable.
      render(<RatingBreakdown breakdown={sampleBreakdown} totalReviews={20} />);

      expect(announcementFor(5)).toBe('5 stars: 10 reviews, 50%');
      expect(announcementFor(3)).toBe('3 stars: 3 reviews, 15%');
    });

    it('says "1 star" and "1 review", not "1 stars"', () => {
      render(<RatingBreakdown breakdown={sampleBreakdown} totalReviews={20} />);

      expect(announcementFor(2)).toBe('2 stars: 1 review, 5%');
      expect(announcementFor(1)).toBe('1 star: 0 reviews, 0%');
    });

    it('announces a level with no reviews rather than leaving a blank bar', () => {
      render(<RatingBreakdown breakdown={sampleBreakdown} totalReviews={20} />);

      expect(announcementFor(1)).toMatch(/0 reviews, 0%/);
    });

    it('is a list, not an image', () => {
      const { container } = render(
        <RatingBreakdown breakdown={sampleBreakdown} totalReviews={20} />
      );

      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(container.querySelectorAll('[role="img"]')).toHaveLength(0);
    });

    it('hides the decorative bar from the accessibility tree', () => {
      const { container } = render(
        <RatingBreakdown breakdown={sampleBreakdown} totalReviews={20} />
      );

      const track = container.querySelector('.rating-breakdown__track');
      expect(track).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('the bar', () => {
    /** The inline width the fill was given, as a number. */
    function widthOf(star, container) {
      const row = [...container.querySelectorAll('.rating-breakdown__row')].find(
        (node) => node.textContent.startsWith(`${star} stars`) ||
          node.textContent.startsWith(`${star} star:`)
      );
      return Number.parseFloat(
        row.querySelector('.rating-breakdown__fill').style.width
      );
    }

    it('measures the same thing as the number beside it', () => {
      // The fill used to be count / maxCount while the text was
      // count / totalReviews, so the tallest bar was always drawn full width.
      // Here that meant a 5★ bar filling the track and labelled 50%.
      const { container } = render(
        <RatingBreakdown breakdown={sampleBreakdown} totalReviews={20} />
      );

      expect(widthOf(5, container)).toBe(50);
      expect(widthOf(4, container)).toBe(30);
      expect(widthOf(1, container)).toBe(0);
    });

    it('never fills a bar past the track', () => {
      const { container } = render(
        <RatingBreakdown breakdown={[{ star: 5, count: 20 }]} totalReviews={20} />
      );

      expect(widthOf(5, container)).toBe(100);
    });
  });

  describe('when totalReviews does not describe the rows', () => {
    it('falls back to the sum of the counts rather than dividing by zero', () => {
      render(<RatingBreakdown breakdown={sampleBreakdown} totalReviews={0} />);

      // 10 of 20 is still half, even with the total omitted.
      expect(announcementFor(5)).toBe('5 stars: 10 reviews, 50%');
    });

    it('survives a breakdown of nothing but zeroes', () => {
      render(
        <RatingBreakdown
          breakdown={[{ star: 5, count: 0 }, { star: 4, count: 0 }]}
          totalReviews={0}
        />
      );

      expect(announcementFor(5)).toBe('5 stars: 0 reviews, 0%');
    });

    it('treats a missing or non-numeric count as zero', () => {
      render(
        <RatingBreakdown
          breakdown={[{ star: 5, count: 4 }, { star: 4 }, { star: 3, count: null }]}
          totalReviews={4}
        />
      );

      expect(announcementFor(4)).toBe('4 stars: 0 reviews, 0%');
      expect(announcementFor(3)).toBe('3 stars: 0 reviews, 0%');
    });
  });
});
