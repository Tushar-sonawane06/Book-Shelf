import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';

/**
 * The guards on the route table, exercised for real.
 *
 * This is a second file rather than more cases in AppRoutes.test.jsx, and the
 * reason is the whole point of #420: that file stubs the guards —
 *
 *   vi.mock('../components/ProtectedRoute.jsx', () => ({
 *     default: ({ children }) => <div data-testid="protected">{children}</div>,
 *   }));
 *
 * — because it is testing which page each path resolves to. So it cannot
 * notice that a route is guarded by the wrong thing, and `AdminRoute.test.jsx`
 * cannot either: it exercises the component in isolation, and the component
 * was correct. It was mounted on nothing.
 *
 * `/admin/inventory` said `<ProtectedRoute>` with no `requireAdmin`, which
 * defaults to false, so any signed-in customer could open the page that
 * creates and deletes books. Both tests passed the whole time.
 *
 * Here the guards are real and only `useAuth` is mocked, so what is under
 * test is the pairing of route to guard.
 */

vi.mock('../hooks/useAuth.js', () => ({ useAuth: vi.fn() }));

vi.mock('../App.jsx', () => ({
  default: () => (
    <div>
      <Outlet />
    </div>
  ),
}));

const stub = (name) => ({ default: () => <div>{name}</div> });

vi.mock('../pages/Home.jsx', () => stub('home-page'));
vi.mock('../pages/BookDetail.jsx', () => stub('book-detail-page'));
vi.mock('../pages/WishlistPage.jsx', () => stub('wishlist-page'));
vi.mock('../pages/OrderHistory.jsx', () => stub('order-history-page'));
vi.mock('../pages/OrderDetailsPage.jsx', () => stub('order-details-page'));
vi.mock('../pages/OrderConfirmation.jsx', () => stub('order-confirmation-page'));
vi.mock('../pages/Checkout.jsx', () => stub('checkout-page'));
vi.mock('../pages/Profile.jsx', () => stub('profile-page'));
vi.mock('../pages/Login.jsx', () => stub('login-page'));
vi.mock('../pages/Register.jsx', () => stub('register-page'));
vi.mock('../pages/AboutUs.jsx', () => stub('about-page'));
vi.mock('../pages/PrivacyPolicy.jsx', () => stub('privacy-page'));
vi.mock('../pages/TermsOfService.jsx', () => stub('terms-page'));
vi.mock('../pages/DesignSystemPage.jsx', () => stub('design-system-page'));
vi.mock('../pages/AdminInventoryPage.jsx', () => stub('admin-inventory-page'));
vi.mock('../pages/StockAlertsPage.jsx', () => stub('stock-alerts-page'));
vi.mock('../pages/NotFound.jsx', () => stub('not-found-page'));

const { useAuth } = await import('../hooks/useAuth.js');
const { default: AppRoutes } = await import('./AppRoutes.jsx');

/** The three states a visitor can be in by the time a guard decides. */
const ANONYMOUS = { user: null, isAuthenticated: false, loading: false };
const CUSTOMER = { user: { role: 'user' }, isAuthenticated: true, loading: false };
const ADMIN = { user: { role: 'admin' }, isAuthenticated: true, loading: false };
const RESTORING = { user: null, isAuthenticated: false, loading: true };

function renderAs(auth, path) {
  useAuth.mockReturnValue(auth);

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

describe('AppRoutes — /admin/inventory', () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  it('lets an admin in', () => {
    renderAs(ADMIN, '/admin/inventory');
    expect(screen.getByText('admin-inventory-page')).toBeInTheDocument();
  });

  it('keeps a signed-in customer out', () => {
    /*
     * The regression. Before the fix this rendered the full inventory
     * manager: the add-book modal, the edit forms, the delete buttons, the
     * stock steppers, the bulk upload panel and the user table.
     */
    renderAs(CUSTOMER, '/admin/inventory');

    expect(screen.queryByText('admin-inventory-page')).not.toBeInTheDocument();
    // Sent home, not to a login form — they are already signed in, and
    // signing in again would not help.
    expect(screen.getByText('home-page')).toBeInTheDocument();
  });

  it('sends an anonymous visitor to sign in, and remembers where they were going', () => {
    renderAs(ANONYMOUS, '/admin/inventory');

    expect(screen.queryByText('admin-inventory-page')).not.toBeInTheDocument();
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('decides nothing while the session is still being restored', () => {
    /*
     * `user` is null until the profile request comes back, so a guard that
     * ran its role check during loading would bounce an admin to the home
     * page on every hard refresh of an admin URL.
     */
    renderAs(RESTORING, '/admin/inventory');

    expect(screen.queryByText('admin-inventory-page')).not.toBeInTheDocument();
    expect(screen.queryByText('home-page')).not.toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('reports the loading state to assistive technology', () => {
    // ProtectedRoute's loading branch had no aria-busy while AdminRoute's
    // did — the two guards were the same component written twice and had
    // already drifted. They share one implementation now.
    renderAs(RESTORING, '/profile');
    expect(screen.getByText('Loading…')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('AppRoutes — the session-only routes stay session-only', () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  it.each([
    ['/profile', 'profile-page'],
    ['/checkout', 'checkout-page'],
    ['/orders', 'order-history-page'],
    ['/order-confirmation', 'order-confirmation-page'],
    ['/account/orders/abc123', 'order-details-page'],
    ['/stock-alerts', 'stock-alerts-page'],
  ])('%s is open to a signed-in customer', (path, expected) => {
    // Tightening the admin route must not have tightened these. A customer
    // has to be able to reach their own profile and their own orders.
    renderAs(CUSTOMER, path);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each([
    ['/profile'],
    ['/checkout'],
    ['/orders'],
    ['/stock-alerts'],
  ])('%s still requires a session', (path) => {
    renderAs(ANONYMOUS, path);
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });
});

describe('AppRoutes — the public routes need no session', () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  it.each([
    ['/', 'home-page'],
    ['/book/b1', 'book-detail-page'],
    ['/wishlist', 'wishlist-page'],
    ['/about', 'about-page'],
    ['/login', 'login-page'],
  ])('%s renders for an anonymous visitor', (path, expected) => {
    renderAs(ANONYMOUS, path);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
