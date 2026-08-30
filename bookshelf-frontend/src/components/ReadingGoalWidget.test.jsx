import { render, screen, waitFor } from '@testing-library/react';
import ReadingGoalWidget from './ReadingGoalWidget.jsx';

jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { _id: 'u1', name: 'Test' } }),
}));

jest.mock('../services/readingGoalService.js', () => ({
  getGoal: jest.fn().mockResolvedValue({
    yearlyGoal: 24,
    stats: {
      yearlyGoal: 24,
      totalRead: 10,
      percentage: 42,
      remaining: 14,
      paceNeeded: 2,
      onTrack: true,
    },
    months: [
      { month: 1, booksRead: 2 },
      { month: 2, booksRead: 3 },
      { month: 3, booksRead: 5 },
    ],
  }),
}));

describe('ReadingGoalWidget', () => {
  it('renders the progress percentage', async () => {
    render(<ReadingGoalWidget />);
    await waitFor(() => {
      expect(screen.getByText('42%')).toBeInTheDocument();
    });
  });

  it('renders books read count', async () => {
    render(<ReadingGoalWidget />);
    await waitFor(() => {
      expect(screen.getByText(/10 of 24 books/)).toBeInTheDocument();
    });
  });

  it('shows on-track status', async () => {
    render(<ReadingGoalWidget />);
    await waitFor(() => {
      expect(screen.getByText(/On track/)).toBeInTheDocument();
    });
  });

  it('renders SVG ring', async () => {
    const { container } = render(<ReadingGoalWidget />);
    await waitFor(() => {
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(2); // bg + fill
    });
  });

  it('shows month count', async () => {
    render(<ReadingGoalWidget />);
    await waitFor(() => {
      expect(screen.getByText(/this month/)).toBeInTheDocument();
    });
  });
});

describe('ReadingGoalWidget - logged out', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../context/AuthContext.jsx', () => ({
      useAuth: () => ({ user: null }),
    }));
  });

  it('shows login hint for unauthenticated users', () => {
    const { default: Widget } = require('./ReadingGoalWidget.jsx');
    render(<Widget />);
    expect(screen.getByText(/Log in to track your reading goal/)).toBeInTheDocument();
  });
});
