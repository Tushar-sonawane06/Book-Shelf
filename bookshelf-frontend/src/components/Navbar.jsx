import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useCart } from '../hooks/useCart.js';
import { useAuth } from '../hooks/useAuth.js';
import ThemeToggle from './ThemeToggle.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import './Navbar.css';

/**
 * Sections that live on the home page rather than at a route of their own.
 *
 * These were `<a href="/#shelf">`, which is a full document navigation: the
 * React tree is torn down and rebuilt, the cart drawer closes, the search box
 * empties, AuthContext re-runs checkAuth() and the whole bundle is re-parsed.
 * They are routes now, and the hash is scrolled to by the effect below —
 * React Router does not do that on its own, which is why the old anchors did
 * nothing at all when clicked from /book/:id. See #316.
 */
const HOME_SECTIONS = [
  { hash: '#shelf', labelKey: null, fallback: 'The Shelf' },
  { hash: '#catalog', labelKey: 'navbar.catalog', fallback: 'Browse' },
];

/** Routes shown to everyone. */
const PUBLIC_LINKS = [
  { to: '/wishlist', labelKey: 'navbar.wishlist', fallback: 'Wishlist' },
  { to: '/orders', labelKey: 'navbar.orders', fallback: 'Orders' },
  { to: '/about', labelKey: 'navbar.about', fallback: 'About' },
];

/**
 * Total books in the cart.
 *
 * The badge used to render `cart.length`, which is the number of *lines*.
 * Five copies of one book read as "1" while the drawer it opens showed
 * quantity 5.
 */
export function cartItemCount(cart) {
  if (!Array.isArray(cart)) {
    return 0;
  }

  return cart.reduce((total, item) => {
    const quantity = Number(item?.quantity);
    return Number.isFinite(quantity) && quantity > 0 ? total + quantity : total;
  }, 0);
}

function MenuIcon({ open }) {
  return open ? (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ) : (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export default function Navbar({ searchQuery, setSearchQuery }) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cart, setIsCartOpen } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  // useAuth() reads a context with no default value, so it is undefined when
  // the navbar is rendered outside AuthProvider — which happens in tests and
  // in Storybook-style harnesses. The navbar is chrome; it degrades to the
  // signed-out view rather than throwing.
  const auth = useAuth() ?? {};
  const { isAuthenticated = false, user = null, logout } = auth;

  const itemCount = useMemo(() => cartItemCount(cart), [cart]);

  /*
   * Scroll to the hash target after a hash navigation.
   *
   * React Router restores neither scroll position nor hash anchors. Without
   * this, `/#catalog` from a book page navigates home and then sits at the
   * top of the page — the exact "clicking Browse does nothing" report.
   *
   * requestAnimationFrame because the target section belongs to the route
   * that is only just mounting; querying for it synchronously finds nothing.
   */
  useEffect(() => {
    if (!location.hash) {
      return;
    }

    let frame = 0;

    const scrollToTarget = () => {
      const target = document.querySelector(location.hash);
      if (!target) {
        return;
      }

      const prefersReducedMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      )?.matches;

      /*
       * Guarded because this runs from a requestAnimationFrame callback,
       * which is outside React's tree and outside any error boundary — an
       * exception here is an uncaught one that takes down whatever is
       * running. `scrollIntoView` is not universally implemented (jsdom does
       * not have it at all), and the callback can also fire against a node
       * from a route that has already been replaced.
       *
       * This was already failing intermittently: the frontend test run exits
       * non-zero roughly half the time on main with "target.scrollIntoView
       * is not a function", because whether the rAF callback lands before
       * the test environment is torn down depends on how busy the run is.
       */
      if (typeof target.scrollIntoView !== 'function') {
        return;
      }

      try {
        target.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      } catch {
        // Scrolling to an anchor is a nicety. It must never be the reason
        // an uncaught exception escapes.
      }
    };

    frame = window.requestAnimationFrame(scrollToTarget);

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.hash, location.key]);

  const closeMobileMenu = useCallback(() => setMobileOpen(false), []);

  const openCart = useCallback(() => {
    setIsCartOpen(true);
    setMobileOpen(false);
  }, [setIsCartOpen]);

  const handleLogout = useCallback(async () => {
    setMobileOpen(false);

    try {
      await logout?.();
    } catch (error) {
      // AuthContext already drops the local session in its own finally block,
      // so the user is signed out here regardless. Swallowing the rejection
      // rather than letting it escape keeps a failed network call from
      // surfacing as an unhandled promise rejection.
      console.error('[navbar] logout failed:', error);
    }

    navigate('/');
  }, [logout, navigate]);

  const label = (key, fallback) => (key ? t(key) || fallback : fallback);

  /*
   * The admin link was shown to every signed-in user, which is the visible
   * half of #420: the route behind it only checked for a session, so the
   * navbar was not merely advertising a page customers could not use — it was
   * advertising one they could open. The route is guarded now, and following
   * this link as a customer would bounce them to the home page, which reads
   * as a broken link. So it is only offered to the people it works for.
   */
  const isAdmin = user?.role === 'admin';

  const accountLinks = isAuthenticated
    ? [
        { to: '/profile', label: t('navbar.profile') || 'Profile' },
        { to: '/account/orders', label: 'My orders' },
        ...(isAdmin
          ? [{ to: '/admin/inventory', label: '🛠️ Admin Inventory' }]
          : []),
        { to: '/design-system', label: '🎨 Design System' },
      ]
    : [{ to: '/design-system', label: '🎨 Design System' }];

  const cartLabel = t('navbar.cart') || 'Cart';
  const cartAriaLabel =
    itemCount === 0
      ? 'Open cart, empty'
      : `Open cart, ${itemCount} ${itemCount === 1 ? 'book' : 'books'}`;

  return (
    <div className="nav-wrapper">
      <header className="nav">
        <div className="nav__inner">
          {/*
            Was `<a href="/">`. Clicking the logo reloaded the entire
            application — the single most-clicked element in the chrome was
            also the most expensive.
          */}
          <Link to="/" className="nav__brand">
            <span className="nav__book-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
            {t('navbar.logo') || 'BookShelf'}
          </Link>

          <nav className="nav__links" aria-label="Main">
            {HOME_SECTIONS.map((section) => (
              <Link key={section.hash} to={`/${section.hash}`}>
                {label(section.labelKey, section.fallback)}
              </Link>
            ))}

            {PUBLIC_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {label(link.labelKey, link.fallback)}
              </NavLink>
            ))}

            {accountLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {link.label}
              </NavLink>
            ))}

            {/*
              The navbar rendered a hardcoded "Login" on every render and
              never imported useAuth, so a signed-in user was still told to
              log in and had no way to sign out or reach /profile.
            */}
            {isAuthenticated ? (
              <button type="button" className="nav__logout" onClick={handleLogout}>
                {user?.name ? `${t('navbar.logout') || 'Log out'} (${user.name})` : t('navbar.logout') || 'Log out'}
              </button>
            ) : (
              <NavLink
                to="/login"
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {t('navbar.login') || 'Login'}
              </NavLink>
            )}
          </nav>

          <div className="nav__actions">
            <input
              className="nav__search"
              type="search"
              placeholder={t('navbar.searchPlaceholder') || 'Search titles, authors...'}
              value={searchQuery || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery?.(val);
                if (location.pathname !== '/' && val.trim()) {
                  navigate(`/?search=${encodeURIComponent(val.trim())}`);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && location.pathname !== '/') {
                  navigate(`/?search=${encodeURIComponent(searchQuery || '')}`);
                }
              }}
              aria-label={t('navbar.searchPlaceholder') || 'Search titles, authors'}
            />

            <LanguageSwitcher />

            <ThemeToggle variant="inline" className="nav__theme-toggle" />

            <button className="nav__cart" onClick={openCart} aria-label={cartAriaLabel}>
              {cartLabel}
              {/* An empty cart does not need a badge reading "0". */}
              {itemCount > 0 && (
                <span className="nav__cart-count" data-testid="cart-count">
                  {itemCount}
                </span>
              )}
            </button>
          </div>

          <button
            className="nav__hamburger"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>

        {mobileOpen && (
          <div className="nav__mobile-menu">
            {HOME_SECTIONS.map((section) => (
              <Link
                key={section.hash}
                to={`/${section.hash}`}
                onClick={closeMobileMenu}
              >
                {label(section.labelKey, section.fallback)}
              </Link>
            ))}

            {PUBLIC_LINKS.map((link) => (
              <Link key={link.to} to={link.to} onClick={closeMobileMenu}>
                {label(link.labelKey, link.fallback)}
              </Link>
            ))}

            {accountLinks.map((link) => (
              <Link key={link.to} to={link.to} onClick={closeMobileMenu}>
                {link.label}
              </Link>
            ))}

            {isAuthenticated ? (
              <button
                type="button"
                className="nav__logout nav__logout--mobile"
                onClick={handleLogout}
              >
                Log out
              </button>
            ) : (
              <Link to="/login" onClick={closeMobileMenu}>
                Login
              </Link>
            )}

            <input
              className="nav__search nav__search--mobile"
              type="search"
              placeholder={t('navbar.searchPlaceholder') || 'Search titles, authors...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('navbar.searchPlaceholder') || 'Search titles, authors'}
            />

            <button className="nav__mobile-cart-btn" onClick={openCart}>
              {cartLabel}
              {itemCount > 0 ? ` (${itemCount})` : ''}
            </button>
          </div>
        )}
      </header>
    </div>
  );
}
