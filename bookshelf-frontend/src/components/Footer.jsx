import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer" id="about">
      <div className="footer__inner">
        <div>
          <p className="footer__brand">BookShelf</p>
          <p className="footer__tagline">A small, honest storefront for people who read.</p>
        </div>
        <p className="footer__note">Open source · Built with React &amp; Node</p>
      </div>
    </footer>
  );
}
