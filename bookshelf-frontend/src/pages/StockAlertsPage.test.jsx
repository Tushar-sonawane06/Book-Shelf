import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

/**
 * The stock alerts page.
 *
 * The bug (#422): the list rendered `alert.bookTitle || alert.bookId`, and
 * nothing in the system has ever produced a `bookTitle` — `models/StockAlert.js`
 * stores `userId`, `bookId`, `notified` and `notifiedAt`, and `getMyAlerts`
 * returns those documents unchanged. So the fallback ran every time and every
 * row showed a raw catalogue id.
 *
 * The tests that were here asserted the page's heading and its subtitle,
 * which is how that shipped: neither of them rendered a single alert. These
 * give the page alerts.
 */

const apiGet = vi.fn();

vi.mock('../utils/api.js', () => ({
  default: { get: (...args) => apiGet(...args) },
}));

const unsubscribeStockAlert = vi.fn();

vi.mock('../services/stockAlertService.js', () => ({
  unsubscribeStockAlert: (...args) => unsubscribeStockAlert(...args),
}));

const getBooksByIds = vi.fn();

vi.mock('../services/bookService.js', () => ({
  getBooksByIds: (...args) => getBooksByIds(...args),
}));

import StockAlertsPage from './StockAlertsPage.jsx';

const ALERTS = [
  { _id: 'a1', bookId: 'b3', createdAt: '2026-02-01T00:00:00.000Z', notified: false },
  { _id: 'a2', bookId: 'b7', createdAt: '2026-02-04T00:00:00.000Z', notified: false },
];

const CATALOGUE = [
  { id: 'b3', title: 'Half Moon Bay', author: 'R. Iyer', price: 399, cover: '#B85C2C' },
  { id: 'b7', title: 'The Quiet Ones', author: 'N. Rao', price: 349, cover: '#7A2E2E' },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <StockAlertsPage />
    </MemoryRouter>
  );
}

/** The happy path: alerts that all resolve against the catalogue. */
function withAlerts(alerts = ALERTS, books = CATALOGUE) {
  apiGet.mockResolvedValue({ data: alerts });
  getBooksByIds.mockResolvedValue({ books, missingIds: [], failedIds: [] });
}

describe('StockAlertsPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    getBooksByIds.mockReset();
    unsubscribeStockAlert.mockReset();
    apiGet.mockResolvedValue({ data: [] });
    getBooksByIds.mockResolvedValue({ books: [], missingIds: [], failedIds: [] });
  });

  it('renders the page title', async () => {
    renderPage();
    expect(screen.getByText('My Stock Alerts')).toBeInTheDocument();
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
  });

  it('shows subtitle', async () => {
    renderPage();
    expect(screen.getByText(/waiting to come back/)).toBeInTheDocument();
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
  });

  it('names the books instead of showing raw ids', async () => {
    // The regression. Every row used to read "b3" / "b7".
    withAlerts();
    renderPage();

    expect(await screen.findByText('Half Moon Bay')).toBeInTheDocument();
    expect(screen.getByText('The Quiet Ones')).toBeInTheDocument();

    expect(screen.queryByText('b3')).not.toBeInTheDocument();
    expect(screen.queryByText('b7')).not.toBeInTheDocument();
  });

  it('resolves the ids against the catalogue rather than a local copy', async () => {
    withAlerts();
    renderPage();

    await screen.findByText('Half Moon Bay');

    expect(getBooksByIds).toHaveBeenCalled();
    expect(getBooksByIds.mock.calls[0][0]).toEqual(['b3', 'b7']);
  });

  it('shows the author and price alongside the title', async () => {
    withAlerts();
    renderPage();

    await screen.findByText('Half Moon Bay');
    expect(screen.getByText('R. Iyer')).toBeInTheDocument();
    expect(screen.getByText('₹399.00')).toBeInTheDocument();
  });

  it('still links each row to the book page', async () => {
    withAlerts();
    renderPage();

    const link = await screen.findByRole('link', { name: 'Half Moon Bay' });
    expect(link).toHaveAttribute('href', '/book/b3');
  });

  it('keeps the rows in the order the alerts arrived', async () => {
    withAlerts();
    renderPage();

    await screen.findByText('Half Moon Bay');

    // useBooksByIds orders its result by the requested ids, so a slow
    // response for the first book must not push it to the bottom.
    const titles = screen
      .getAllByRole('link', { name: /Half Moon Bay|The Quiet Ones/ })
      .map((node) => node.textContent);

    expect(titles).toEqual(['Half Moon Bay', 'The Quiet Ones']);
  });

  it('explains a book the catalogue no longer has, rather than showing a bare id', async () => {
    apiGet.mockResolvedValue({ data: ALERTS });
    getBooksByIds.mockResolvedValue({
      books: [CATALOGUE[0]],
      missingIds: ['b7'],
      failedIds: [],
    });

    renderPage();

    await screen.findByText('Half Moon Bay');
    // The id is the only thing known about it, so it is still shown — but
    // with a sentence saying why, not as a bare "b7".
    expect(screen.getByText('b7')).toBeInTheDocument();
    expect(screen.getByText(/no longer in the catalogue/i)).toBeInTheDocument();
  });

  it('does not claim a book is delisted when the request merely failed', async () => {
    // failedIds is a network problem, not a delisting. Saying "no longer
    // available" about a reachable book would be a lie told by the network.
    apiGet.mockResolvedValue({ data: [ALERTS[1]] });
    getBooksByIds.mockResolvedValue({ books: [], missingIds: [], failedIds: ['b7'] });

    renderPage();

    expect(await screen.findByText(/details could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/no longer in the catalogue/i)).not.toBeInTheDocument();
  });

  it('renders no date rather than "Invalid Date" when createdAt is missing', async () => {
    withAlerts([{ _id: 'a1', bookId: 'b3' }], [CATALOGUE[0]]);
    renderPage();

    await screen.findByText('Half Moon Bay');
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Subscribed/)).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no alerts', async () => {
    renderPage();
    expect(
      await screen.findByText(/don't have any stock alerts yet/i)
    ).toBeInTheDocument();
  });

  it('does not flash the empty state while the books are still resolving', async () => {
    apiGet.mockResolvedValue({ data: ALERTS });
    // A request that never settles: the page must stay busy rather than
    // conclude there are no alerts.
    getBooksByIds.mockReturnValue(new Promise(() => {}));

    renderPage();

    await waitFor(() => expect(getBooksByIds).toHaveBeenCalled());
    expect(
      screen.queryByText(/don't have any stock alerts yet/i)
    ).not.toBeInTheDocument();
  });

  describe('removing an alert', () => {
    it('drops the row on success', async () => {
      const user = userEvent.setup();
      withAlerts();
      unsubscribeStockAlert.mockResolvedValue({});

      renderPage();
      await screen.findByText('Half Moon Bay');

      await user.click(
        screen.getByRole('button', { name: /remove stock alert for Half Moon Bay/i })
      );

      await waitFor(() =>
        expect(screen.queryByText('Half Moon Bay')).not.toBeInTheDocument()
      );
      expect(unsubscribeStockAlert).toHaveBeenCalledWith('b3');
      expect(screen.getByText('The Quiet Ones')).toBeInTheDocument();
    });

    it('reports a failure on the row, not in the page banner', async () => {
      const user = userEvent.setup();
      withAlerts();
      unsubscribeStockAlert.mockRejectedValue({ status: 500, message: 'Server error' });

      renderPage();
      await screen.findByText('Half Moon Bay');

      await user.click(
        screen.getByRole('button', { name: /remove stock alert for Half Moon Bay/i })
      );

      const rowError = await screen.findByRole('alert');
      expect(rowError).toHaveTextContent(/could not remove this alert|server error/i);

      // The row is still there — the alert was not removed.
      expect(screen.getByText('Half Moon Bay')).toBeInTheDocument();
    });

    it('disables the button while its own request is in flight', async () => {
      const user = userEvent.setup();
      withAlerts();

      let resolveRemoval;
      unsubscribeStockAlert.mockReturnValue(
        new Promise((resolve) => {
          resolveRemoval = resolve;
        })
      );

      renderPage();
      await screen.findByText('Half Moon Bay');

      const button = screen.getByRole('button', {
        name: /remove stock alert for Half Moon Bay/i,
      });

      await user.click(button);

      // A second click used to send a second DELETE, and the second answered
      // 404 — an error about an alert that had just been removed.
      await waitFor(() => expect(button).toBeDisabled());
      expect(button).toHaveTextContent(/removing/i);

      // The other row is unaffected.
      expect(
        screen.getByRole('button', { name: /remove stock alert for The Quiet Ones/i })
      ).not.toBeDisabled();

      resolveRemoval({});
    });
  });
});
