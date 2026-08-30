import './BookActions.css';

export default function BookActions({
  book,
  onAddToCart = () => {},
  onWishlist = () => {},
  onCompare = () => {},
  onShare = () => {},
}) {
  return (
    <div className="book-actions">
      <button
        className="book-actions__button book-actions__button--cart"
        onClick={() => onAddToCart(book)}
        aria-label="Add to Cart"
      >
        🛒 <span>Quick Cart</span>
      </button>

      <button
        className="book-actions__icon"
        onClick={() => onWishlist(book)}
        aria-label="Add to Wishlist"
        title="Wishlist"
      >
        ❤
      </button>

      <button
        className="book-actions__icon"
        onClick={() => onCompare(book)}
        aria-label="Compare"
        title="Compare"
      >
        ⇄
      </button>

      <button
        className="book-actions__icon"
        onClick={() => onShare(book)}
        aria-label="Share"
        title="Share"
      >
        🔗
      </button>
    </div>
  );
}
