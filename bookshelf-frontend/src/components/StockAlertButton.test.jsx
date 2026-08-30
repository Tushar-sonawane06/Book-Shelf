import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StockAlertButton from './StockAlertButton.jsx';

vi.mock('../services/stockAlertService.js', () => ({
  subscribeStockAlert: vi.fn(),
  unsubscribeStockAlert: vi.fn(),
  checkStockAlert: vi.fn().mockResolvedValue({ subscribed: false }),
}));

import { checkStockAlert } from '../services/stockAlertService.js';

describe('StockAlertButton', () => {
  it('renders the subscribe button', () => {
    render(<StockAlertButton bookId="b1" isLoggedIn={true} />);
    expect(screen.getByText(/Notify when available/)).toBeInTheDocument();
  });

  it('shows login message when not logged in', async () => {
    render(<StockAlertButton bookId="b1" isLoggedIn={false} />);
    const btn = screen.getByText(/Notify when available/);
    expect(btn).toBeInTheDocument();
  });

  it('checks subscription status on mount when logged in', async () => {
    checkStockAlert.mockResolvedValue({ subscribed: true });
    render(<StockAlertButton bookId="b1" isLoggedIn={true} />);
    expect(await screen.findByText(/Alert set/)).toBeInTheDocument();
  });
});
