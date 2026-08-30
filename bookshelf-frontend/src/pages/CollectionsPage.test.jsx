import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CollectionsPage from './CollectionsPage.jsx';

vi.mock('../services/collectionService.js', () => ({
  getCollections: vi.fn().mockResolvedValue([]),
  createCollection: vi.fn(),
  deleteCollection: vi.fn(),
  addBookToCollection: vi.fn(),
  removeBookFromCollection: vi.fn(),
}));

vi.mock('../services/bookService.js', () => ({
  getBooksByIds: vi.fn().mockResolvedValue({ books: [], missingIds: [] }),
}));

describe('CollectionsPage', () => {
  it('renders the page title', () => {
    render(
      <MemoryRouter>
        <CollectionsPage />
      </MemoryRouter>
    );
    expect(screen.getByText('My Collections')).toBeInTheDocument();
  });

  it('shows empty state when no collections', async () => {
    render(
      <MemoryRouter>
        <CollectionsPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/No collections yet/)).toBeInTheDocument();
  });

  it('shows the create button', () => {
    render(
      <MemoryRouter>
        <CollectionsPage />
      </MemoryRouter>
    );
    expect(screen.getByText('+ New Collection')).toBeInTheDocument();
  });
});
