import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const getDashboardStats = vi.fn();
const getSalesTrend = vi.fn();
const getTopBooks = vi.fn();
const getRecentOrders = vi.fn();

vi.mock('../services/adminService.js', () => ({
  getDashboardStats: (...args) => getDashboardStats(...args),
  getSalesTrend: (...args) => getSalesTrend(...args),
  getTopBooks: (...args) => getTopBooks(...args),
  getRecentOrders: (...args) => getRecentOrders(...args),
}));

import AdminDashboard from './AdminDashboard.jsx';
import AdminTopBooks from '../components/AdminTopBooks.jsx';
import AdminRecentOrders from '../components/AdminRecentOrders.jsx';
import AdminSalesChart from '../components/AdminSalesChart.jsx';

/**
 * Money on the admin dashboard.
 *
 * Every figure here used to be `₹${value.toLocaleString()}` — a hardcoded
 * symbol next to grouping taken from whatever locale the browser happens to
 * be set to. `1234567` is `₹12,34,567` in rupees and `₹1,234,567` is not, and
 * which one a visitor saw depended on their machine.
 *
 * jsdom runs in en-US, so a regression here reproduces exactly the way it did
 * in a browser: these assertions fail on the old code and pass on the new.
 */

const STATS = {
  totalRevenue: 1234567,
  totalOrders: 4820,
  totalUsers: 913,
  totalBooks: 128,
  avgOrderValue: 256,
};

describe('AdminDashboard money', () => {
  beforeEach(() => {
    getDashboardStats.mockReset();
    getSalesTrend.mockReset().mockResolvedValue({ trend: [] });
    getTopBooks.mockReset().mockResolvedValue({ topBooks: [] });
    getRecentOrders.mockReset().mockResolvedValue({ orders: [] });
  });

  it('groups rupees the Indian way, not the host locale way', async () => {
    getDashboardStats.mockResolvedValue(STATS);

    render(<AdminDashboard />);

    expect(await screen.findByText('₹12,34,567')).toBeInTheDocument();
    expect(screen.queryByText('₹1,234,567')).not.toBeInTheDocument();
  });

  it('drops the trailing paise on a whole-rupee figure', async () => {
    getDashboardStats.mockResolvedValue(STATS);

    render(<AdminDashboard />);

    expect(await screen.findByText('₹256')).toBeInTheDocument();
  });

  it('shows a dash, not ₹0, for a KPI the API did not return', async () => {
    // `|| 0` used to render this as ₹0 — a dashboard stating zero revenue
    // when what it knows is nothing.
    getDashboardStats.mockResolvedValue({ ...STATS, totalRevenue: undefined });

    render(<AdminDashboard />);

    await waitFor(() => expect(screen.getByText('₹256')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('still shows ₹0 for a real zero', async () => {
    getDashboardStats.mockResolvedValue({ ...STATS, totalRevenue: 0 });

    render(<AdminDashboard />);

    expect(await screen.findByText('₹0')).toBeInTheDocument();
  });

  it('surfaces the error rather than rendering figures it does not have', async () => {
    getDashboardStats.mockRejectedValue(new Error('aggregation timed out'));

    render(<AdminDashboard />);

    expect(await screen.findByText(/aggregation timed out/i)).toBeInTheDocument();
  });
});

describe('AdminTopBooks money', () => {
  beforeEach(() => {
    getTopBooks.mockReset();
  });

  it('groups revenue the Indian way', async () => {
    getTopBooks.mockResolvedValue({
      topBooks: [{ bookId: 'b1', title: 'The Quiet Ones', totalSold: 42, totalRevenue: 1234567 }],
    });

    render(<AdminTopBooks />);

    expect(await screen.findByText('₹12,34,567')).toBeInTheDocument();
  });

  it('renders a row whose revenue came back null instead of throwing', async () => {
    // `book.totalRevenue.toLocaleString()` was a TypeError on this row, which
    // takes the whole table down with it.
    getTopBooks.mockResolvedValue({
      topBooks: [{ bookId: 'b1', title: 'The Quiet Ones', totalSold: 0, totalRevenue: null }],
    });

    render(<AdminTopBooks />);

    expect(await screen.findByText('The Quiet Ones')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('AdminRecentOrders money', () => {
  beforeEach(() => {
    getRecentOrders.mockReset();
  });

  it('groups order totals the Indian way', async () => {
    getRecentOrders.mockResolvedValue({
      orders: [
        {
          id: 'order_abc123',
          customerName: 'A. Sharma',
          itemCount: 3,
          total: 1234567,
          status: 'paid',
          createdAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    });

    render(<AdminRecentOrders />);

    expect(await screen.findByText('₹12,34,567')).toBeInTheDocument();
  });
});

describe('AdminSalesChart money', () => {
  beforeEach(() => {
    getSalesTrend.mockReset();
  });

  it('groups the tooltip figure the Indian way', async () => {
    getSalesTrend.mockResolvedValue({
      trend: [{ date: '2026-08-01', revenue: 1234567 }],
    });

    render(<AdminSalesChart />);

    expect(await screen.findByText('₹12,34,567')).toBeInTheDocument();
  });
});
