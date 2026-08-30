import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import CheckoutGateway from './CheckoutGateway.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

/**
 * CheckoutGateway — the three ways into checkout.
 *
 * The two things worth pinning down here are the two that were wrong: how it
 * decides someone is signed in, and how it moves them to the login page. Both
 * used to bypass the app (a localStorage key nothing writes, and a
 * `window.location.href` assignment), and neither is the kind of mistake a
 * render test catches unless it is asked about directly.
 */

/** Reports the current route and its state so navigation can be asserted on. */
function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      <span data-testid="from">{location.state?.from?.pathname ?? ''}</span>
    </div>
  );
}

function renderGateway({
  isAuthenticated = false,
  onProceedToGuest = vi.fn(),
  onProceedToAuth = vi.fn(),
} = {}) {
  render(
    <MemoryRouter initialEntries={['/checkout']}>
      <AuthContext.Provider value={{ isAuthenticated, user: null }}>
        <Routes>
          <Route
            path="/checkout"
            element={
              <CheckoutGateway
                onProceedToGuest={onProceedToGuest}
                onProceedToAuth={onProceedToAuth}
              />
            }
          />
          <Route path="/login" element={<LocationProbe />} />
          <Route path="/signup" element={<LocationProbe />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  );

  return { onProceedToGuest, onProceedToAuth };
}

describe('CheckoutGateway', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('offers all three ways to check out', () => {
    renderGateway();

    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeInTheDocument();
  });

  it('sends a guest straight to the guest form', async () => {
    const user = userEvent.setup();
    const { onProceedToGuest } = renderGateway();

    await user.click(screen.getByRole('button', { name: /continue as guest/i }));

    expect(onProceedToGuest).toHaveBeenCalledTimes(1);
  });

  it('skips the choice for a customer who is already signed in', async () => {
    const { onProceedToAuth } = renderGateway({ isAuthenticated: true });

    await waitFor(() => expect(onProceedToAuth).toHaveBeenCalled());
  });

  it('reads the session from AuthContext, not a localStorage flag', () => {
    // The old component looked for an `isAuthenticated` key that nothing in
    // this project ever writes, so the skip above could never fire. Setting
    // it must not be what decides this.
    window.localStorage.setItem('isAuthenticated', 'true');

    const { onProceedToAuth } = renderGateway({ isAuthenticated: false });

    expect(onProceedToAuth).not.toHaveBeenCalled();
  });

  it('renders without an AuthProvider above it', () => {
    // AuthContext has no default value, so useAuth() is undefined here.
    const onProceedToAuth = vi.fn();
    render(
      <MemoryRouter>
        <CheckoutGateway onProceedToGuest={vi.fn()} onProceedToAuth={onProceedToAuth} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Checkout' })
    ).toBeInTheDocument();
    expect(onProceedToAuth).not.toHaveBeenCalled();
  });

  it('routes to the login page instead of reloading the document', async () => {
    const user = userEvent.setup();
    renderGateway();

    await user.click(screen.getByRole('button', { name: /log in/i }));

    // A `window.location.href = '/login'` would have left this route in place.
    expect(await screen.findByTestId('location')).toHaveTextContent('/login');
  });

  it('remembers where the customer came from, so login can send them back', async () => {
    const user = userEvent.setup();
    renderGateway();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByTestId('from')).toHaveTextContent('/checkout');
  });

  it('does not re-run the auth skip on every render', async () => {
    // onProceedToAuth used to be an effect dependency while the page passed a
    // fresh inline arrow each render, so the effect fired on every render.
    const onProceedToAuth = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <AuthContext.Provider value={{ isAuthenticated: true, user: null }}>
          <CheckoutGateway onProceedToGuest={vi.fn()} onProceedToAuth={onProceedToAuth} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => expect(onProceedToAuth).toHaveBeenCalledTimes(1));

    rerender(
      <MemoryRouter>
        <AuthContext.Provider value={{ isAuthenticated: true, user: null }}>
          <CheckoutGateway onProceedToGuest={vi.fn()} onProceedToAuth={onProceedToAuth} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(onProceedToAuth).toHaveBeenCalledTimes(1);
  });
});
