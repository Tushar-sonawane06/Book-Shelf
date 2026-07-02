import './Navbar.css';

export default function Navbar({ cartCount, onCartClick }) {
  return (
    <header className="nav">
      <div className="nav__inner">
        <a href="/" className="nav__brand">
          <span className="nav__mark">☰</span>
          BookShelf
        </a>

        <nav className="nav__links">
          <a href="#shelf">The Shelf</a>
          <a href="#catalog">Browse</a>
          <a href="#about">About</a>
        </nav>

        <div className="nav__actions">
          <input className="nav__search" type="search" placeholder="Search titles, authors…" />
          <button className="nav__cart" onClick={onCartClick} aria-label="Open cart">
            Cart
            <span className="nav__cart-count">{cartCount}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
