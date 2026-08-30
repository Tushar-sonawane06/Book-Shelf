import { useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';

import BackToTopButton from './components/BackToTopButton.jsx';
import RouteChangeHandler from './components/RouteChangeHandler.jsx';
import SkipLink from './components/SkipLink.jsx';

import CustomCursor from './components/CustomCursor.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import RecentlyViewed from './components/RecentlyViewed.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import CompareBar from './components/CompareBar.jsx';

import './App.css';

/**
 * App is the layout shell, not a page.
 *
 * It owns the chrome that should persist across navigations (navbar, footer,
 * cart drawer, cursor) and renders whichever page matched through <Outlet />.
 * The route table itself lives in routes/AppRoutes.jsx so there is exactly
 * one of them.
 *
 * The search input lives in the navbar but the results are rendered by Home,
 * so the query is held here and passed down through the outlet context.
 * Pages that need it read it with useOutletContext().
 */
export default function App() {
  const [searchQuery, setSearchQuery] = useState('');

  /*
   * The one element a skip link can target and a route change can focus.
   *
   * Pages own their own <main>: Home, BookDetail, Checkout, OrderConfirmation,
   * WishlistPage and NotFound each render one, while OrderHistory, Profile,
   * OrderDetailsPage, Login and Register render none at all. So there was no
   * single element to send focus to, and adding one to eleven pages would put
   * the same rule in eleven places. The layout owns it instead.
   *
   * `tabIndex={-1}` makes it focusable programmatically without adding a tab
   * stop of its own. Its id is `main-content` rather than `catalog`, which
   * Home already uses for the `/#catalog` anchor in the navbar.
   *
   * It is a <div>, not a <main>: the pages that render their own <main> would
   * otherwise be nesting one inside another, and two `main` landmarks is
   * worse for a screen reader than the wrapper being unlabelled.
   */
  const contentRef = useRef(null);

  return (
    <div className="app">
      {/*
        First in the DOM, so it is the first thing Tab reaches. A keyboard
        user arriving at any page had to walk the whole navbar — brand, two
        section links, three public links, up to two account links,
        login/logout, search, theme toggle, cart, hamburger — before reaching
        the content. See #339.
      */}
      <SkipLink targetId="main-content" />

      {/*
        Resets the scroll position and moves focus on navigation.

        The component that used to sit here was called ScrollToTop, which read
        as though this were already handled. It is a floating back-to-top
        button and always was: it never looked at the location. Nothing in the
        app reset scroll, so opening a book from the bottom of the catalogue
        landed on the book page already scrolled past its title. It is renamed
        to what it is, and the real thing sits above it.
      */}
      <RouteChangeHandler contentRef={contentRef} />

      {/*
        The theme toggle used to be rendered here *as well as* in the navbar,
        as two separate components each holding their own copy of the theme.
        It now lives only in the navbar, reading the shared ThemeContext.
      */}
      <BackToTopButton />
      <CustomCursor />

      <Navbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <div className="nav-spacer" />

      <div id="main-content" ref={contentRef} tabIndex={-1}>
        <Outlet context={{ searchQuery, setSearchQuery }} />
      </div>

      <RecentlyViewed />
      <Footer />

      <CartDrawer />
      <CompareBar />
    </div>
  );
}
