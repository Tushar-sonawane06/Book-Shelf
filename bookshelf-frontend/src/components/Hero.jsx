import { spines } from '../data/books.js';
import './Hero.css';

export default function Hero() {
  return (
    <section className="hero" id="shelf">
      <div className="hero__inner">
        <div className="hero__copy">
          <p className="hero__eyebrow">A shelf, not a warehouse</p>
          <h1 className="hero__title">
            Pull a book out.
            <br />
            See where it takes you.
          </h1>
          <p className="hero__sub">
            BookShelf is a small, honest storefront — no algorithms deciding what you
            should read next. Browse by spine, not by suggestion.
          </p>
          <a className="hero__cta" href="#catalog">Browse the catalog →</a>
        </div>

        <div className="shelf" role="list" aria-label="Featured books">
          {spines.map((book) => (
            <div
              className="shelf__spine"
              role="listitem"
              tabIndex={0}
              key={book.id}
              style={{ '--spine-color': book.color, '--spine-height': `${book.height}px` }}
            >
              <div className="shelf__spine-face">
                <span className="shelf__spine-title">{book.title}</span>
              </div>
              <div className="shelf__tag">
                <strong>{book.title}</strong>
                <span>{book.author}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="shelf__board" aria-hidden="true" />
      </div>
    </section>
  );
}
