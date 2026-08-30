import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewCard from './ReviewCard.jsx';

/**
 * Unit tests for the ReviewCard component.
 *
 * Exercises rendering, star display, verified-purchase badge, and the
 * helpful-button interaction.
 */

const baseReview = {
  id: 'r1',
  userId: 'u1',
  bookId: 'b1',
  rating: 4,
  title: 'Great book',
  body: 'Really enjoyed it.',
  verifiedPurchase: false,
  helpfulCount: 3,
  createdAt: '2025-06-15T12:00:00Z',
  userName: 'Alice',
};

describe('ReviewCard', () => {
  it('renders the star rating correctly', () => {
    render(<ReviewCard review={baseReview} />);
    const filledStars = screen.getAllByText('★').filter((el) =>
      el.className.includes('review-card__star--filled')
    );
    expect(filledStars).toHaveLength(4);
  });

  it('renders the review title and body', () => {
    render(<ReviewCard review={baseReview} />);
    expect(screen.getByText('Great book')).toBeInTheDocument();
    expect(screen.getByText('Really enjoyed it.')).toBeInTheDocument();
  });

  it('renders the author name', () => {
    render(<ReviewCard review={baseReview} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders the verified purchase badge when true', () => {
    render(
      <ReviewCard review={{ ...baseReview, verifiedPurchase: true }} />
    );
    expect(screen.getByText(/Verified Purchase/)).toBeInTheDocument();
  });

  it('does not render the verified badge when false', () => {
    render(<ReviewCard review={baseReview} />);
    expect(screen.queryByText(/Verified Purchase/)).not.toBeInTheDocument();
  });

  it('shows helpful count', () => {
    render(<ReviewCard review={baseReview} />);
    expect(screen.getByText(/Helpful \(3\)/)).toBeInTheDocument();
  });

  it('calls onHelpful when the helpful button is clicked', async () => {
    const onHelpful = vi.fn().mockResolvedValue(undefined);
    render(
      <ReviewCard review={baseReview} currentUserId="u2" onHelpful={onHelpful} />
    );

    fireEvent.click(screen.getByText(/Helpful/));
    expect(onHelpful).toHaveBeenCalledWith('r1');
  });

  it('hides the helpful button for the review author', () => {
    render(
      <ReviewCard review={baseReview} currentUserId="u1" onHelpful={vi.fn()} />
    );
    expect(screen.queryByText(/Helpful/)).not.toBeInTheDocument();
  });

  it('returns null for a missing review', () => {
    const { container } = render(<ReviewCard review={null} />);
    expect(container.firstChild).toBeNull();
  });
});
