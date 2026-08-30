import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import './CheckoutGateway.css';

/**
 * The choice a visitor makes before they start checking out: sign in, create
 * an account, or carry on as a guest.
 *
 * Two things were wrong with the first version of this and both had the same
 * shape — it went around the app's own machinery instead of through it.
 *
 * It read `localStorage.getItem('isAuthenticated')` to decide whether the
 * visitor was signed in. Nothing in this project writes that key. `AuthContext`
 * is where the session lives, it is restored from the cookie on mount, and it
 * is what `AdminRoute` and the navbar already read. A key that is never
 * written is always null, so the skip never fired and a signed-in customer was
 * asked to sign in.
 *
 * And "Log In" was `window.location.href = '/login'`. That is a full document
 * load in a single-page app: the router unmounts, every provider remounts, and
 * the cart the customer was about to pay for is rebuilt from localStorage on
 * the way. `navigate` keeps them in the same document, and carrying the
 * current location in `state.from` means the login page can send them back to
 * checkout rather than to the home page.
 */
export default function CheckoutGateway({ onProceedToGuest, onProceedToAuth }) {
  const navigate = useNavigate();
  const location = useLocation();
  // The tests render this without an AuthProvider above it, and so does any
  // future story that mounts it in isolation; AuthContext has no default
  // value, so this is undefined there rather than an object.
  const auth = useAuth();
  const isAuthenticated = Boolean(auth?.isAuthenticated);

  useEffect(() => {
    // Someone who is already signed in has nothing to choose between — send
    // them straight to the address step.
    if (isAuthenticated) {
      onProceedToAuth();
    }
  }, [isAuthenticated, onProceedToAuth]);

  const goTo = (path) => navigate(path, { state: { from: location } });

  return (
    <div className="checkout-gateway">
      <div className="checkout-gateway__inner">
        <h2 className="checkout-gateway__title">Checkout</h2>
        <p className="checkout-gateway__subtitle">
          Choose how you would like to proceed with your order.
        </p>

        <div className="checkout-gateway__options">
          <div className="checkout-gateway__option">
            <h3>Already have an account?</h3>
            <p>Log in for faster checkout and to track your order history.</p>
            <button
              type="button"
              className="checkout-gateway__btn checkout-gateway__btn--primary"
              onClick={() => goTo('/login')}
            >
              Log In
            </button>
          </div>

          <div className="checkout-gateway__divider">OR</div>

          <div className="checkout-gateway__option">
            <h3>New here?</h3>
            <p>Create an account to save your details for future purchases.</p>
            <button
              type="button"
              className="checkout-gateway__btn"
              onClick={() => goTo('/signup')}
            >
              Create Account
            </button>
          </div>

          <div className="checkout-gateway__divider">OR</div>

          <div className="checkout-gateway__option">
            <h3>Fast checkout without creating an account</h3>
            <p>You can complete your purchase as a guest. No account required.</p>
            <button
              type="button"
              className="checkout-gateway__btn"
              onClick={onProceedToGuest}
            >
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
