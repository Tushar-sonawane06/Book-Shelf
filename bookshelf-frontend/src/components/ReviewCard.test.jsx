import { render, screen, fireEvent } from '@testing-library/react';
import ReviewCard from './ReviewCard.jsx';

const baseReview = {
  id: 'rev1',
  bookId: 'b1',
  userId: 'u1',
  userName: 'Alice',
  userAvatar: '🧑‍💻',
  rating: 4,
  title: 'Great book',
  body: 'Really enjoyed it.',
  helpfulCount: 3,
  verifiedPurchase: true,
  userHasVotedHelpful: false,
  createdAt: '2026-08-15T10:00:00Z',
};

describe('ReviewCard', () => {
  it('renders reviewer name and rating', () => {
    render(<ReviewCard review={baseReview} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByLabelText(/Rating: 4 out of 5/)).toBeInTheDocument();
  });

  it('renders the review title and body', () => {
    render(<ReviewCard review={baseReview} />);
    expect(screen.getByText('Great book')).toBeInTheDocument();
    expect(screen.getByText('Really enjoyed it.')).toBeInTheDocument();
  });

  it('shows verified purchase badge when applicable', () => {
    render(<ReviewCard review={baseReview} />);
    expect(screen.getByText(/Verified Purchase/)).toBeInTheDocument();
  });

  it('hides verified purchase badge when not a verified purchase', () => {
    render(<ReviewCard review={{ ...baseReview, verifiedPurchase: false }} />);
    expect(screen.queryByText(/Verified Purchase/)).not.toBeInTheDocument();
  });

  it('shows helpful button for non-owner authenticated users', () => {
    render(<ReviewCard review={baseReview} currentUserId="other-user" onHelpfulToggle={jest.fn()} />);
    expect(screen.getByText(/Helpful/)).toBeInTheDocument();
  });

  it('calls onHelpfulToggle when helpful button is clicked', () => {
    const onHelpful = jest.fn();
    render(<ReviewCard review={baseReview} currentUserId="other-user" onHelpfulToggle={onHelpful} />);
    fireEvent.click(screen.getByText(/Helpful/));
    expect(onHelpful).toHaveBeenCalledWith('rev1');
  });

  it('shows edit and delete buttons for the owner', () => {
    render(<ReviewCard review={baseReview} currentUserId="u1" />);
    expect(screen.getByText(/Edit/)).toBeInTheDocument();
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = jest.fn();
    render(<ReviewCard review={baseReview} currentUserId="u1" onEdit={onEdit} />);
    fireEvent.click(screen.getByText(/Edit/));
    expect(onEdit).toHaveBeenCalledWith(baseReview);
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = jest.fn();
    render(<ReviewCard review={baseReview} currentUserId="u1" onDelete={onDelete} />);
    fireEvent.click(screen.getByText(/Delete/));
    expect(onDelete).toHaveBeenCalledWith('rev1');
  });

  it('shows helpful count when user is not authenticated', () => {
    render(<ReviewCard review={baseReview} />);
    expect(screen.getByText(/3 found this helpful/)).toBeInTheDocument();
  });

  it('does not show helpful button for the review owner', () => {
    render(<ReviewCard review={baseReview} currentUserId="u1" onHelpfulToggle={jest.fn()} />);
    expect(screen.queryByText(/Helpful/)).not.toBeInTheDocument();
  });
});
