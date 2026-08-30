import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

import paymentService from '../services/paymentService.js';
import CheckoutForm from '../components/CheckoutForm.jsx';
import CheckoutGateway from '../components/CheckoutGateway.jsx';
import CouponInput from '../components/CouponInput.jsx';
import GuestCheckoutForm from '../components/GuestCheckoutForm.jsx';
import { useCart } from '../hooks/useCart.js';
import {
  ADDRESS_FIELDS,
  EMPTY_ADDRESS,
  cartSubtotal,
  countItems,
  describeCheckoutError,
  normaliseAddress,
  toOrderItems,
  validateAddress,
} from '../utils/checkoutValidation.js';
import { formatMoney } from '../utils/currency.js';
import '../components/CouponInput.css';
import './Checkout.css';
import { usePageMetadata } from '../hooks/usePageMetadata.js';

/**
 * loadStripe is called once at module scope, not per render — the Stripe
 * object is expensive and recreating it on every render breaks Elements.
 *
 * No `|| 'pk_test_mock_stripe_key_123'` fallback. A publishable key is not a
 * secret, but a *fake* one fails at the point where a customer is trying to
 * pay, which is the worst place to discover a missing environment variable.
 * Missing means missing, and the page says so.
 */
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

/**
 * The summary renders in the currency the *server* priced the order in, not
 * in one this page assumes.
 *
 * This used to be a local `formatRupees`, while the payment intent behind the
 * card form was created in USD — so the panel said ₹1,157.84 and the Stripe
 * element next to it said $1,157.84. `POST /api/payments/create-intent`
 * returns the currency now, and it is what the totals below are labelled
 * with. Before the call has been made there is nothing authoritative to go
 * on, so the deployment's own currency stands in. See #335.
 */
const money = (amount, currency) =>
  formatMoney(amount ?? 0, { currency, fallback: formatMoney(0, { currency }) });

/**
 * Checkout, in two steps.
 *
 * Step one collects the shipping address. Step two mounts Stripe Elements
 * against the client secret that came back. Nothing is sent to the API until
 * the address validates, and nothing is sent at all if the cart is empty —
 * previously the effect fired on mount unconditionally and created a
 * server-side order for a customer who had not filled anything in and might
 * not have had a cart. See #315.
 */
export default function Checkout() {
  usePageMetadata({
    title: 'Checkout',
    description:
      'Complete your BookShelf order — shipping details and secure card payment.',
  });

  const { cart, clearCart } = useCart();
  const navigate = useNavigate();

  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [clientSecret, setClientSecret] = useState('');
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState(null);
  // Only known once the server has priced the cart; until then the summary
  // labels its subtotal with this deployment's configured currency.
  const [currency, setCurrency] = useState(undefined);
  /*
   * The code the customer typed, and the coupon the *server* actually
   * applied. Two values, deliberately.
   *
   * `couponCode` is an intent: what to send with the next create-intent call.
   * `appliedCoupon` is a fact: what came back on the response, alongside the
   * total that was charged for it. The summary renders the fact.
   *
   * They used to be one thing — a discount from `/api/coupons/validate`,
   * rendered next to a total that had never heard of it, so the page showed a
   * saving the customer did not get. See #418.
   */
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponNotice, setCouponNotice] = useState('');

  /*
   * Which of the three views the page is showing: the address form
   * ('standard'), the choice of how to check out ('gateway'), or the guest
   * details form ('guest').
   *
   * It lives here, with the other hooks, and not next to the branch that
   * reads it. It used to sit below the "checkout unavailable" early return,
   * so a deployment with no publishable key ran one fewer hook than one with
   * a key and React threw `Rendered more hooks than during the previous
   * render` the moment the two rendered in sequence. Same defect as #365 and
   * #366: what matters is where the call is, not where the value is used.
   */
  const [mode, setMode] = useState('standard');

  const items = useMemo(() => toOrderItems(cart), [cart]);
  const bookCount = useMemo(() => countItems(cart), [cart]);
  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);

  const handleFieldChange = useCallback((name, value) => {
    setAddress((previous) => ({ ...previous, [name]: value }));
    // Clear this field's error as soon as the customer edits it. Leaving it
    // on screen while they type reads as "still wrong" when it may not be.
    setFieldErrors((previous) => {
      if (!previous[name]) {
        return previous;
      }
      const next = { ...previous };
      delete next[name];
      return next;
    });
  }, []);

  const handleSubmitAddress = async (event) => {
    event.preventDefault();

    const normalised = normaliseAddress(address);
    setAddress(normalised);

    const errors = validateAddress(normalised);
    setFieldErrors(errors);
    setFormError('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (items.length === 0) {
      setFormError('Your cart is empty.');
      return;
    }

    setSubmitting(true);

    try {
      // The cart, not a sample book. Only ids and quantities travel; the
      // server prices every line from the catalogue.
      const data = await paymentService.createPaymentIntent({
        items,
        shippingAddress: normalised,
        /*
         * The code only. Not the discount, and not the subtotal — the server
         * prices the cart from the catalogue and recomputes what the coupon
         * is worth against *that*. A client that could state its own discount
         * could state its own price.
         */
        couponCode: couponCode || undefined,
      });

      if (!data?.clientSecret) {
        throw new Error('The payment could not be prepared. Please try again.');
      }

      setClientSecret(data.clientSecret);
      setOrderId(data.orderId ?? '');
      setAmount(data.amount ?? null);
      setCurrency(data.currency ?? data.amount?.currency);

      /*
       * What the server did with the code, which is not always what the
       * preview promised: a coupon can expire, be deactivated or hit its
       * usage limit between the customer applying it and submitting the
       * address. The order is priced without it in that case rather than
       * refused — the cart is still good — so the page has to say why the
       * discount is gone instead of quietly dropping the row.
       */
      setAppliedCoupon(data.coupon ?? null);
      setCouponNotice(
        data.couponError
          ? `${data.couponError.message}. The order has been priced without it.`
          : ''
      );
    } catch (error) {
      // The old page swallowed this into console.error and left the customer
      // on a spinner forever. Say what happened and let them retry.
      console.error('[checkout] could not create the payment intent:', error);
      setFormError(describeCheckoutError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaid = useCallback(() => {
    // Only once the payment is actually confirmed. Clearing earlier loses the
    // cart of anyone whose card is declined.
    clearCart();
  }, [clearCart]);

  /*
   * Stable identities, because CheckoutGateway takes onProceedToAuth as an
   * effect dependency. Passed as inline arrows these were a fresh function on
   * every render, so the effect re-ran on every render and only stopped
   * looping because setMode happened to be called with the value it already
   * held.
   */
  const showGateway = useCallback(() => setMode('gateway'), []);
  const showAddressStep = useCallback(() => setMode('standard'), []);
  const showGuestStep = useCallback(() => setMode('guest'), []);

  const handleGuestOrderComplete = useCallback(() => {
    clearCart();
    navigate('/order-confirmation');
  }, [clearCart, navigate]);

  if (!stripePromise) {
    return (
      <main className="checkout">
        <div className="checkout__panel checkout__panel--message">
          <h1 className="checkout__title">Checkout unavailable</h1>
          <p>
            Payments are not configured for this deployment. Set{' '}
            <code>VITE_STRIPE_PUBLISHABLE_KEY</code> and rebuild the frontend.
          </p>
          <Link className="checkout__link-btn" to="/">
            Back to the shop
          </Link>
        </div>
      </main>
    );
  }

  if (items.length === 0 && !clientSecret) {
    return (
      <main className="checkout">
        <div className="checkout__panel checkout__panel--message">
          <h1 className="checkout__title">Your cart is empty</h1>
          <p>Add a book before checking out.</p>
          <Link className="checkout__link-btn" to="/">
            Browse the shelf
          </Link>
        </div>
      </main>
    );
  }

  if (mode === 'gateway') {
    return (
      <main className="checkout">
        <CheckoutGateway
          onProceedToAuth={showAddressStep}
          onProceedToGuest={showGuestStep}
        />
      </main>
    );
  }

  if (mode === 'guest') {
    return (
      <main className="checkout">
        <GuestCheckoutForm
          onBack={showAddressStep}
          onOrderComplete={handleGuestOrderComplete}
        />
      </main>
    );
  }

  return (
    <main className="checkout">
      <h1 className="checkout__title">Secure checkout</h1>

      {/*
        The gateway is how someone gets to the guest form. Before this it was
        unreachable: `mode` started at 'standard' and the only setter on the
        page passed 'guest', so the component, its stylesheet and the log-in
        and register choices it offers were dead from the day they merged.
      */}
      <p className="checkout__alt">
        Checking out for the first time?{' '}
        <button type="button" className="checkout__alt-btn" onClick={showGateway}>
          See your options
        </button>
      </p>

      <div className="checkout__layout">
        <section className="checkout__panel" aria-labelledby="checkout-details">
          <h2 id="checkout-details" className="checkout__section-title">
            {clientSecret ? 'Payment' : 'Shipping address'}
          </h2>

          {clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: { theme: 'stripe' } }}
            >
              <CheckoutForm
                orderId={orderId}
                onPaid={handlePaid}
                onNavigate={navigate}
              />
            </Elements>
          ) : (
            <form className="checkout__form" onSubmit={handleSubmitAddress} noValidate>
              {ADDRESS_FIELDS.map((field) => {
                const errorId = `${field.name}-error`;
                const error = fieldErrors[field.name];

                return (
                  <label className="checkout__field" key={field.name}>
                    <span className="checkout__label">{field.label}</span>
                    <input
                      className={`checkout__input ${
                        error ? 'checkout__input--invalid' : ''
                      }`}
                      name={field.name}
                      type="text"
                      value={address[field.name]}
                      autoComplete={field.autoComplete}
                      placeholder={field.placeholder}
                      maxLength={field.maxLength}
                      aria-invalid={error ? 'true' : 'false'}
                      aria-describedby={error ? errorId : undefined}
                      onChange={(event) =>
                        handleFieldChange(field.name, event.target.value)
                      }
                    />
                    {error && (
                      <span className="checkout__error" id={errorId} role="alert">
                        {error}
                      </span>
                    )}
                  </label>
                );
              })}

              {formError && (
                <p className="checkout__error checkout__error--form" role="alert">
                  {formError}
                </p>
              )}

              <button
                className="checkout__submit"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Preparing payment…' : 'Continue to payment'}
              </button>
            </form>
          )}
        </section>

        <aside className="checkout__panel checkout__summary" aria-label="Order summary">
          <h2 className="checkout__section-title">Order summary</h2>

          <CouponInput
            subtotal={subtotal}
            currency={currency}
            onApply={(result) => {
              // Only the code is kept. The saving shown in the badge is the
              // preview's estimate; the binding number arrives with the
              // payment intent and is rendered in the totals below.
              setCouponCode(result.code || '');
              setCouponNotice('');
            }}
            onRemove={() => {
              setCouponCode('');
              setAppliedCoupon(null);
              setCouponNotice('');
            }}
            disabled={!!clientSecret}
          />

          {couponNotice && (
            <p className="checkout__coupon-notice" role="status">
              {couponNotice}
            </p>
          )}

          <ul className="checkout__lines">
            {cart.map((item) => (
              <li className="checkout__line" key={item.id ?? item.bookId}>
                <span className="checkout__line-title">
                  {item.title}
                  <span className="checkout__line-qty"> × {item.quantity}</span>
                </span>
                <span className="checkout__line-price">
                  {money(Number(item.price ?? 0) * Number(item.quantity ?? 0), currency)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="checkout__totals">
            <div className="checkout__total-row">
              <dt>Subtotal ({bookCount} {bookCount === 1 ? 'book' : 'books'})</dt>
              <dd>{money(amount ? amount.subtotal : subtotal, currency)}</dd>
            </div>

            {amount && (
              <>
                {/*
                  Rendered from the server's response, and only when the
                  server actually applied something. It sits between the
                  subtotal and the tax because that is where it lands in the
                  arithmetic — the tax below is charged on the discounted
                  goods.
                */}
                {amount.discount > 0 && (
                  <div className="checkout__total-row checkout__total-row--discount">
                    <dt>
                      Discount
                      {appliedCoupon?.code ? ` (${appliedCoupon.code})` : ''}
                    </dt>
                    <dd className="checkout__discount">
                      −{money(amount.discount, currency)}
                    </dd>
                  </div>
                )}

                <div className="checkout__total-row">
                  <dt>Tax</dt>
                  <dd>{money(amount.tax, currency)}</dd>
                </div>
                <div className="checkout__total-row">
                  <dt>Shipping</dt>
                  <dd>{money(amount.shipping, currency)}</dd>
                </div>
                <div className="checkout__total-row checkout__total-row--grand">
                  <dt>Total</dt>
                  <dd>{money(amount.total, currency)}</dd>
                </div>
              </>
            )}
          </dl>

          {!amount && (
            <p className="checkout__note">
              Tax and shipping are calculated at the next step.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
