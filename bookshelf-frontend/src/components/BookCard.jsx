import './BookCard.css';

export default function BookCard({ book, onAddToCart }) {
  return (
    <article className="book-card">
      <div className="book-card__cover" style={{ '--cover-color': book.cover }}>
        <span className="book-card__genre">{book.genre}</span>
        <span className="book-card__cover-title">{book.title}</span>
      </div>

      <div className="book-card__body">
        <h3 className="book-card__title">{book.title}</h3>
        <p className="book-card__author">{book.author}</p>

        <div className="book-card__meta">
          <span className="book-card__rating">★ {book.rating.toFixed(1)}</span>
          <span className="book-card__price">₹{book.price}</span>
        </div>

        <button className="book-card__add" onClick={() => onAddToCart(book)}>
          Add to cart
        </button>
      </div>
    </article>
  );
}
