import { render, screen, waitFor } from '@testing-library/react';
import PriceAlertWidget from './PriceAlertWidget.jsx';

// Mock auth hook
jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { _id: 'u1', name: 'Test User' } }),
}));

// Mock price alert service
jest.mock('../services/priceAlertService.js', () => ({
  checkAlert: jest.fn().mockResolvedValue({ hasAlert: false, alert: null }),
  createAlert: jest.fn().mockResolvedValue({ alert: { id: 'a1', targetPrice: 250 } }),
  deleteByBookId: jest.fn().mockResolvedValue({}),
}));

jest.mock('../utils/bookFormat.js', () => ({
  formatPrice: (p) => `₹${p}`,
}));

describe('PriceAlertWidget', () => {
  it('renders the price alert heading', () => {
    render(<PriceAlertWidget bookId="b1" currentPrice={349} />);
    expect(screen.getByText(/Price Alert/)).toBeInTheDocument();
  });

  it('shows current price', () => {
    render(<PriceAlertWidget bookId="b1" currentPrice={349} />);
    expect(screen.getByText(/Current price/)).toBeInTheDocument();
    expect(screen.getByText('₹349')).toBeInTheDocument();
  });

  it('shows target price input', () => {
    render(<PriceAlertWidget bookId="b1" currentPrice={349} />);
    expect(screen.getByLabelText(/Notify me when price drops to/)).toBeInTheDocument();
  });

  it('shows set alert button', () => {
    render(<PriceAlertWidget bookId="b1" currentPrice={349} />);
    expect(screen.getByText('Set alert')).toBeInTheDocument();
  });

  it('suggests 10% below current price as default', () => {
    render(<PriceAlertWidget bookId="b1" currentPrice={300} />);
    const input = screen.getByLabelText(/Notify me when price drops to/);
    expect(input.value).toBe('270');
  });
});

describe('PriceAlertWidget - logged out', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../context/AuthContext.jsx', () => ({
      useAuth: () => ({ user: null }),
    }));
  });

  it('shows login prompt for unauthenticated users', () => {
    const { default: Widget } = require('./PriceAlertWidget.jsx');
    render(<Widget bookId="b1" currentPrice={349} />);
    expect(screen.getByText(/Log in to set a price drop alert/)).toBeInTheDocument();
  });
});
