import { render, screen, waitFor } from '@testing-library/react';
import BookshelfWidget from './BookshelfWidget.jsx';

// Mock the hooks
jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { _id: 'u1', name: 'Test User' } }),
}));

jest.mock('../hooks/useReadingList.js', () => ({
  useReadingList: () => ({
    entries: [],
    stats: null,
    loading: false,
    checkBook: jest.fn().mockResolvedValue({ onList: false, entry: null }),
    addBook: jest.fn().mockResolvedValue({ entry: { id: 'e1', shelf: 'want-to-read' } }),
    update: jest.fn().mockResolvedValue({ entry: { id: 'e1', shelf: 'currently-reading' } }),
    removeBook: jest.fn().mockResolvedValue({}),
  }),
}));

describe('BookshelfWidget', () => {
  it('renders three shelf buttons', () => {
    render(<BookshelfWidget bookId="b1" />);
    expect(screen.getByText(/Want to Read/)).toBeInTheDocument();
    expect(screen.getByText(/Currently Reading/)).toBeInTheDocument();
    expect(screen.getByText(/Finished/)).toBeInTheDocument();
  });

  it('shows expand button after being added to list', async () => {
    render(<BookshelfWidget bookId="b1" />);
    // Click "Want to Read" to add
    const { useReadingList } = require('../hooks/useReadingList.js');
    const mock = useReadingList();
    // Simulate add
    const wantBtn = screen.getByText(/Want to Read/);
    wantBtn.click();
    await waitFor(() => {
      expect(screen.getByText(/More options/)).toBeInTheDocument();
    });
  });
});

describe('BookshelfWidget - logged out', () => {
  beforeEach(() => {
    // Override auth mock for logged-out state
    jest.resetModules();
    jest.doMock('../context/AuthContext.jsx', () => ({
      useAuth: () => ({ user: null }),
    }));
  });

  it('shows login prompt for unauthenticated users', () => {
    const { default: Widget } = require('./BookshelfWidget.jsx');
    render(<Widget bookId="b1" />);
    expect(screen.getByText(/Log in to add this book/)).toBeInTheDocument();
  });
});
