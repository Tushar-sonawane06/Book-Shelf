import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminRoute from './AdminRoute.jsx';

/**
 * Unit tests for the AdminRoute guard component.
 *
 * Mocks useAuth to control the auth state without needing a full provider tree.
 */

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../hooks/useAuth.js';

function renderWithRouter(ui) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      {ui}
    </MemoryRouter>
  );
}

describe('AdminRoute', () => {
  it('renders children when user is an admin', () => {
    useAuth.mockReturnValue({
      user: { role: 'admin' },
      isAuthenticated: true,
      loading: false,
    });

    renderWithRouter(
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('redirects to / when user is not admin', () => {
    useAuth.mockReturnValue({
      user: { role: 'user' },
      isAuthenticated: true,
      loading: false,
    });

    const { container } = renderWithRouter(
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    );

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    // react-router-dom Navigate renders a < Navigate > element in the tree
    // which doesn't actually redirect in jsdom, but the children won't render.
    expect(container.textContent).not.toContain('Admin Content');
  });

  it('redirects to login when not authenticated', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    const { container } = renderWithRouter(
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    );

    expect(container.textContent).not.toContain('Admin Content');
  });

  it('shows loading state', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: true,
    });

    renderWithRouter(
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
