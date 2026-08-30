import { Routes, Route, Navigate } from 'react-router-dom';

import App from '../App.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import AdminRoute from '../components/AdminRoute.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

import Home from '../pages/Home.jsx';
import BookDetail from '../pages/BookDetail.jsx';
import WishlistPage from '../pages/WishlistPage.jsx';
import OrderHistory from '../pages/OrderHistory.jsx';
import OrderDetailsPage from '../pages/OrderDetailsPage.jsx';
import OrderConfirmation from '../pages/OrderConfirmation.jsx';
import Checkout from '../pages/Checkout.jsx';
import Profile from '../pages/Profile.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import AboutUs from '../pages/AboutUs.jsx';
import PrivacyPolicy from '../pages/PrivacyPolicy.jsx';
import TermsOfService from '../pages/TermsOfService.jsx';
import AdminInventoryPage from '../pages/AdminInventoryPage.jsx';
import DesignSystemPage from '../pages/DesignSystemPage.jsx';
import NotFound from '../pages/NotFound.jsx';
import StockAlertsPage from '../pages/StockAlertsPage.jsx';

/**
 * The single route table for the app.
 *
 * Everything lives under one layout route so the navbar, footer and cart
 * drawer mount once and stay mounted across navigations. Previously the app
 * had two separate <Routes> trees — one in main.jsx and one inside App — and
 * because the outer one was declared as `path="/"` (exact) rather than
 * `path="/*"`, the inner tree could never match. Every route declared inside
 * App was unreachable.
 */
export default function AppRoutes() {
  return (
    <Routes>
      {/*
        The boundary wraps the layout route, so it covers the App shell —
        navbar, footer, cart drawer — as well as every page. That matters:
        CartDrawer is mounted on every route, so a throw inside it used to
        blank the site rather than one page. It sits inside the router so its
        recovery actions can still navigate.
      */}
      <Route
        path="/"
        element={
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        }
      >
        {/* Public */}
        <Route index element={<Home />} />
        <Route path="book/:id" element={<BookDetail />} />
        <Route path="wishlist" element={<WishlistPage />} />
        <Route path="about" element={<AboutUs />} />
        <Route path="privacy" element={<PrivacyPolicy />} />
        <Route path="terms" element={<TermsOfService />} />
        <Route path="design-system" element={<DesignSystemPage />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route path="signup" element={<Navigate to="/register" replace />} />

        {/*
          Requires admin — and now actually checks for it.

          This said `<ProtectedRoute>` with no `requireAdmin`, and that prop
          defaults to false, so the only thing the route checked was that
          somebody was signed in. Any registered customer who typed the URL
          got the full inventory manager: the add-book modal, the edit forms,
          the delete buttons, the stock steppers, the bulk upload panel and
          the user table. The backend's `protect, admin` middleware is the
          only reason the catalogue survived that, which makes every action on
          the page fail with an error rather than the page being closed.

          `AdminRoute` is used rather than `<ProtectedRoute requireAdmin>`
          because a guard whose protection depends on remembering a prop is
          the thing that failed here. See #420.
        */}
        <Route
          path="admin/inventory"
          element={
            <AdminRoute>
              <AdminInventoryPage />
            </AdminRoute>
          }
        />

        {/* Requires a session */}
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="order-confirmation"
          element={
            <ProtectedRoute>
              <OrderConfirmation />
            </ProtectedRoute>
          }
        />
        {/*
          One order history, at one route.

          There were two: /orders read a localStorage key that nothing wrote
          and was therefore always empty, and /account/orders read the API.
          The navbar linked to the empty one. /orders is the API-backed page
          now — which means it needs a session, because GET /api/orders/mine
          does — and /account/orders redirects to it rather than 404ing the
          links and bookmarks that already point there. See #326.
        */}
        <Route
          path="orders"
          element={
            <ProtectedRoute>
              <OrderHistory />
            </ProtectedRoute>
          }
        />
        <Route path="account/orders" element={<Navigate to="/orders" replace />} />
        <Route
          path="account/orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetailsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="stock-alerts"
          element={
            <ProtectedRoute>
              <StockAlertsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
