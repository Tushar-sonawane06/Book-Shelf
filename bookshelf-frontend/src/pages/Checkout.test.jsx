import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

/*
 * Stripe is mocked wholesale. The point of these tests is *what gets sent to
 * the payment API* — which was the entire bug in #315 — and that question is
 * answered before Stripe.js is involved at all.
 */
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve({ id: 'stripe' })),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => null,
  useElements: () => null,
}));

const createPaymentIntent = vi.fn();

vi.mock('../services/paymentService.js', () => ({
  default: {
    createPaymentIntent: (...args) => createPaymentIntent(...args),
  },
}));

const validateCoupon = vi.fn();

vi.mock('../services/couponService.js', () => ({
  validateCoupon: (...args) => validateCoupon(...args),
  default: { validateCoupon: (...args) => validateCoupon(...args) },
}));

const CART = [
  { id: 'b1', title: 'The Quiet Ones', price: 349, quantity: 2, cover: '#7A2E2E' },
  { id: 'b3', title: 'Half Moon Bay', price: 399, quantity: 1, cover: '#B85C2C' },
];

const ADDRESS = {
  name: 'A. Sharma',
  address: '221B Baker Street',
  city: 'Mumbai',
  postalCode: '400001',
  country: 'India',
};

let Checkout;
let CartProvider;

async function loadCheckout({ publishableKey = 'pk_test_fake' } = {}) {
  vi.resetModules();
  vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', publishableKey);
  // Imported after the env is stubbed: the module reads the key at load time
  // so that loadStripe is called once rather than once per render. The cart
  // provider has to come from the same fresh module graph, or the page reads
  // a different CartContext instance than the test rendered.
  Checkout = (await import('./Checkout.jsx')).default;
  CartProvider = (await import('../context/CartContext.jsx')).CartProvider;
}

function renderCheckout(cart = CART) {
  window.localStorage.setItem('cart', JSON.stringify(cart));

  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <CartProvider>
        <Checkout />
      </CartProvider>
    </MemoryRouter>
  );
}

async function fillAddress(user, overrides = {}) {
  const values = { ...ADDRESS, ...overrides };

  for (const [label, value] of [
    ['Full name', values.name],
    ['Street address', values.address],
    ['City', values.city],
    ['Postal code', values.postalCode],
    ['Country', values.country],
  ]) {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    if (value) {
      await user.type(input, value);
    }
  }
}

describe('Checkout', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    createPaymentIntent.mockReset();
    validateCoupon.mockReset();
    await loadCheckout();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does not contact the payment API on mount', async () => {
    renderCheckout();

    // The old page fired the request from a mount effect, so an order was
    // created before the customer had typed anything.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /shipping address/i })).toBeInTheDocument()
    );
    expect(createPaymentIntent).not.toHaveBeenCalled();
  });

  it('shows an empty-cart state instead of checking out with nothing', async () => {
    renderCheckout([]);

    expect(screen.getByRole('heading', { name: /your cart is empty/i })).toBeInTheDocument();
    expect(createPaymentIntent).not.toHaveBeenCalled();
  });

  it('refuses to submit an incomplete address and names each missing field', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(5);
    expect(createPaymentIntent).not.toHaveBeenCalled();
  });

  it('sends the real cart contents, not a hardcoded sample book', async () => {
    const user = userEvent.setup();
    createPaymentIntent.mockResolvedValue({
      clientSecret: 'pi_secret_123',
      orderId: 'order-1',
      amount: { subtotal: 1097, tax: 54.85, shipping: 5.99, total: 1157.84 },
    });

    renderCheckout();
    await fillAddress(user);
    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(createPaymentIntent).toHaveBeenCalledTimes(1));

    const payload = createPaymentIntent.mock.calls[0][0];

    expect(payload.items).toEqual([
      { bookId: 'b1', quantity: 2 },
      { bookId: 'b3', quantity: 1 },
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/Sample Book|book-1|Jane Doe/);
  });

  it('sends the address the customer typed', async () => {
    const user = userEvent.setup();
    createPaymentIntent.mockResolvedValue({ clientSecret: 'pi_secret_123' });

    renderCheckout();
    await fillAddress(user, { city: '  Pune  ' });
    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(createPaymentIntent).toHaveBeenCalled());

    expect(createPaymentIntent.mock.calls[0][0].shippingAddress).toEqual({
      ...ADDRESS,
      city: 'Pune',
    });
  });

  it('mounts the payment step once the API returns a client secret', async () => {
    const user = userEvent.setup();
    createPaymentIntent.mockResolvedValue({
      clientSecret: 'pi_secret_123',
      orderId: 'order-1',
      amount: { subtotal: 1097, tax: 54.85, shipping: 5.99, total: 1157.84 },
    });

    renderCheckout();
    await fillAddress(user);
    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    // Server-calculated amounts, shown only once the server has calculated them.
    expect(screen.getByText('₹1,157.84')).toBeInTheDocument();
  });

  it('surfaces a rejected cart instead of hanging on a spinner forever', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createPaymentIntent.mockRejectedValue({
      status: 400,
      original: {
        response: {
          data: {
            message: 'Invalid checkout request',
            errors: [{ field: 'items[0].bookId', message: 'Book not found: book-1' }],
          },
        },
      },
    });

    renderCheckout();
    await fillAddress(user);
    await user.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
    // Still on the address step, with the button usable again.
    expect(
      screen.getByRole('button', { name: /continue to payment/i })
    ).toBeEnabled();
  });

  it('says so when no publishable key was built in, rather than using a fake one', async () => {
    await loadCheckout({ publishableKey: '' });
    renderCheckout();

    expect(
      screen.getByRole('heading', { name: /checkout unavailable/i })
    ).toBeInTheDocument();
  });

  it('renders the order summary once', async () => {
    renderCheckout();

    // The merge that broke this file left two <aside> summaries in the tree,
    // each with its own subtotal. It failed the build before it could fail
    // anything else, but a second copy that *did* parse would have been a
    // page showing the same total twice.
    expect(screen.getAllByRole('complementary', { name: /order summary/i })).toHaveLength(1);
    expect(screen.getAllByText(/subtotal/i)).toHaveLength(1);
  });

  /*
   * Guest checkout.
   *
   * The gateway was unreachable when it merged — `mode` began at 'standard'
   * and nothing ever set it to 'gateway' — so the component and its three
   * choices existed but no visitor could get to them. These walk the path.
   */
  describe('the guest path', () => {
    it('offers a way to the checkout options from the address step', async () => {
      renderCheckout();

      expect(
        await screen.findByRole('button', { name: /see your options/i })
      ).toBeInTheDocument();
    });

    it('opens the gateway, and the gateway offers the guest route', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /see your options/i }));

      expect(screen.getByRole('button', { name: /continue as guest/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });

    it('reaches the guest form and can come back from it', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /see your options/i }));
      await user.click(screen.getByRole('button', { name: /continue as guest/i }));

      expect(
        screen.getByRole('heading', { name: /guest checkout/i })
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /back to checkout options/i }));

      expect(
        screen.getByRole('heading', { name: /shipping address/i })
      ).toBeInTheDocument();
    });

    it('never contacts the payment API on the guest detour', async () => {
      const user = userEvent.setup();
      renderCheckout();

      await user.click(screen.getByRole('button', { name: /see your options/i }));
      await user.click(screen.getByRole('button', { name: /continue as guest/i }));

      expect(createPaymentIntent).not.toHaveBeenCalled();
    });
  });

  /*
   * The hook-order defect, directly.
   *
   * `useState` for `mode` sat below the "checkout unavailable" early return.
   * A render that took that branch ran one fewer hook than one that did not,
   * and React throws the moment those two renders happen in sequence in the
   * same tree. Rendering both shapes in one test is what reproduces it.
   */
  it('survives the configured and unconfigured payment states in one session', async () => {
    const errors = [];
    vi.spyOn(console, 'error').mockImplementation((message) => errors.push(String(message)));

    await loadCheckout({ publishableKey: '' });
    const { unmount } = renderCheckout();
    expect(screen.getByRole('heading', { name: /checkout unavailable/i })).toBeInTheDocument();
    unmount();

    await loadCheckout({ publishableKey: 'pk_test_fake' });
    renderCheckout();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /shipping address/i })).toBeInTheDocument()
    );
    expect(errors.join('\n')).not.toMatch(/Rendered more hooks/);
  });

  /*
   * Coupons.
   *
   * The bug (#418): applying a coupon changed the summary and nothing else.
   * The code never reached `create-intent`, so the payment intent was created
   * for the undiscounted total — the page showed a saving the customer was
   * not given. These tests pin the two halves that make that impossible to
   * reintroduce: the code has to travel with the request, and the discount
   * row has to be rendered from the response rather than from the preview.
   */
  describe('coupons', () => {
    const APPLIED = {
      clientSecret: 'cs_test_123',
      orderId: 'order-1',
      currency: 'INR',
      amount: {
        currency: 'INR',
        subtotal: 1097,
        discount: 100,
        tax: 49.85,
        shipping: 49,
        total: 1095.85,
      },
      coupon: { code: 'SAVE100', discount: 100 },
    };

    async function applyCoupon(user, code = 'SAVE100') {
      validateCoupon.mockResolvedValue({
        valid: true,
        code,
        discountType: 'fixed',
        discountValue: 100,
        discount: 100,
        currency: 'INR',
      });

      await user.type(screen.getByPlaceholderText(/have a coupon code/i), code);
      await user.click(screen.getByRole('button', { name: /^apply$/i }));
      await screen.findByText(new RegExp(code));
    }

    it('sends the coupon code to the payment API, and nothing else about it', async () => {
      const user = userEvent.setup();
      createPaymentIntent.mockResolvedValue(APPLIED);

      renderCheckout();
      await applyCoupon(user);
      await fillAddress(user);
      await user.click(screen.getByRole('button', { name: /continue to payment/i }));

      await waitFor(() => expect(createPaymentIntent).toHaveBeenCalledTimes(1));

      const payload = createPaymentIntent.mock.calls[0][0];
      expect(payload.couponCode).toBe('SAVE100');

      /*
       * The client states the code and nothing more. A discount or a subtotal
       * in this payload would be a price the customer had chosen for
       * themselves — the server recomputes both from the catalogue.
       */
      expect(payload).not.toHaveProperty('discount');
      expect(payload).not.toHaveProperty('subtotal');
      expect(payload).not.toHaveProperty('total');
    });

    it('omits the coupon field entirely when no code was applied', async () => {
      const user = userEvent.setup();
      createPaymentIntent.mockResolvedValue({
        clientSecret: 'cs_test_123',
        orderId: 'order-1',
        currency: 'INR',
        amount: { currency: 'INR', subtotal: 1097, discount: 0, tax: 54.85, shipping: 49, total: 1200.85 },
        coupon: null,
      });

      renderCheckout();
      await fillAddress(user);
      await user.click(screen.getByRole('button', { name: /continue to payment/i }));

      await waitFor(() => expect(createPaymentIntent).toHaveBeenCalledTimes(1));
      expect(createPaymentIntent.mock.calls[0][0].couponCode).toBeUndefined();
    });

    it('renders the discount the server applied, and a total that accounts for it', async () => {
      const user = userEvent.setup();
      createPaymentIntent.mockResolvedValue(APPLIED);

      renderCheckout();
      await applyCoupon(user);
      await fillAddress(user);
      await user.click(screen.getByRole('button', { name: /continue to payment/i }));

      const discountRow = await screen.findByText(/discount \(SAVE100\)/i);
      expect(discountRow).toBeInTheDocument();

      // The saving and the total both come from the same response, so they
      // cannot disagree. 1097 − 100 + 49.85 + 49 = 1095.85.
      expect(screen.getByText('−₹100.00')).toBeInTheDocument();
      expect(screen.getByText('₹1,095.85')).toBeInTheDocument();
    });

    it('shows no discount row when the server applied nothing', async () => {
      const user = userEvent.setup();
      createPaymentIntent.mockResolvedValue({
        ...APPLIED,
        amount: { ...APPLIED.amount, discount: 0, tax: 54.85, total: 1200.85 },
        coupon: null,
      });

      renderCheckout();
      await fillAddress(user);
      await user.click(screen.getByRole('button', { name: /continue to payment/i }));

      await screen.findByText('₹1,200.85');
      expect(screen.queryByText(/^Discount/i)).not.toBeInTheDocument();
    });

    it('explains a coupon the server refused instead of dropping it silently', async () => {
      const user = userEvent.setup();

      /*
       * The race this covers: the code validated when the customer typed it,
       * and hit its usage limit while they filled in the address. The order
       * is still valid and still payable, so it is priced without the coupon
       * — but the page has to account for the discount that is no longer
       * there.
       */
      createPaymentIntent.mockResolvedValue({
        ...APPLIED,
        amount: { ...APPLIED.amount, discount: 0, tax: 54.85, total: 1200.85 },
        coupon: null,
        couponError: {
          reason: 'limit_reached',
          message: 'This coupon has reached its usage limit',
        },
      });

      renderCheckout();
      await applyCoupon(user);
      await fillAddress(user);
      await user.click(screen.getByRole('button', { name: /continue to payment/i }));

      const notice = await screen.findByRole('status');
      expect(notice).toHaveTextContent(/reached its usage limit/i);
      expect(notice).toHaveTextContent(/priced without it/i);

      // Priced without it, and the summary says so rather than showing a row.
      expect(screen.queryByText(/^Discount/i)).not.toBeInTheDocument();
      expect(screen.getByText('₹1,200.85')).toBeInTheDocument();
    });

    it('does not block the checkout when the coupon preview fails', async () => {
      const user = userEvent.setup();
      validateCoupon.mockRejectedValue(new Error('Invalid coupon code'));
      createPaymentIntent.mockResolvedValue({
        ...APPLIED,
        amount: { ...APPLIED.amount, discount: 0, tax: 54.85, total: 1200.85 },
        coupon: null,
      });

      renderCheckout();
      await user.type(screen.getByPlaceholderText(/have a coupon code/i), 'NOPE');
      await user.click(screen.getByRole('button', { name: /^apply$/i }));
      await screen.findByText(/invalid coupon code/i);

      await fillAddress(user);
      await user.click(screen.getByRole('button', { name: /continue to payment/i }));

      await waitFor(() => expect(createPaymentIntent).toHaveBeenCalledTimes(1));
      // A code that never applied is not sent.
      expect(createPaymentIntent.mock.calls[0][0].couponCode).toBeUndefined();
    });
  });
});
