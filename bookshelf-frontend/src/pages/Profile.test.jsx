import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Profile from './Profile.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { WishlistContext } from '../context/WishlistContext.jsx';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../components/RecentlyViewed.jsx', () => ({
  default: () => <div data-testid="recently-viewed-mock">Recently Viewed Mock</div>,
}));

vi.mock('../components/FavoriteBooks.jsx', () => ({
  default: () => <div data-testid="favorite-books-mock">Favorite Books Mock</div>,
}));

function renderProfile(user = { name: 'Jane Reader', email: 'jane@example.com', role: 'Member' }, logout = vi.fn()) {
  const authValue = {
    user,
    isAuthenticated: true,
    loading: false,
    logout,
    login: vi.fn(),
    register: vi.fn(),
    checkAuth: vi.fn(),
  };

  const wishlistValue = {
    wishlist: ['b1', 'b2'],
    loading: false,
    count: 2,
    isWishlisted: () => true,
    toggleWishlist: vi.fn(),
  };

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <WishlistContext.Provider value={wishlistValue}>
          <Profile />
        </WishlistContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('Profile Page (Reading Portal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders user details and default analytics in overview tab', () => {
    renderProfile();

    expect(screen.getByText('Jane Reader')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Books Read')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Pages Read')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Reading Hours')[0]).toBeInTheDocument();
  });

  it('allows switching between tabs', async () => {
    const user = userEvent.setup();
    renderProfile();

    // Switch to Reading Goals tab
    const goalsTab = screen.getByRole('button', { name: /🎯 Reading Goals/i });
    await user.click(goalsTab);

    expect(screen.getByText(/Set Your 2026 Annual Book Goal/i)).toBeInTheDocument();
    expect(screen.getByText(/Monthly Target Breakdown/i)).toBeInTheDocument();

    // Switch to Account Settings tab
    const settingsTab = screen.getByRole('button', { name: /⚙️ Account Settings/i });
    await user.click(settingsTab);

    expect(screen.getByText('Profile Information')).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Reader');
  });

  it('allows updating annual goal in goals tab', async () => {
    const user = userEvent.setup();
    renderProfile();

    const goalsTab = screen.getByRole('button', { name: /🎯 Reading Goals/i });
    await user.click(goalsTab);

    const goalInput = screen.getByLabelText(/target books:/i);
    await user.clear(goalInput);
    await user.type(goalInput, '30');

    const saveBtn = screen.getByRole('button', { name: /save goal/i });
    await user.click(saveBtn);

    const stored = JSON.parse(localStorage.getItem('bookshelf_user_profile'));
    expect(stored.annualGoal).toBe(30);
  });

  it('allows editing bio and saving profile settings', async () => {
    const user = userEvent.setup();
    renderProfile();

    const settingsTab = screen.getByRole('button', { name: /⚙️ Account Settings/i });
    await user.click(settingsTab);

    const bioInput = screen.getByPlaceholderText(/share your reading motto/i);
    await user.clear(bioInput);
    await user.type(bioInput, 'Keep reading every single day.');

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveBtn);

    expect(await screen.findByText(/profile updated successfully!/i)).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem('bookshelf_user_profile'));
    expect(stored.bio).toBe('Keep reading every single day.');
  });

  it('handles password updates validation', async () => {
    const user = userEvent.setup();
    renderProfile();

    const settingsTab = screen.getByRole('button', { name: /⚙️ Account Settings/i });
    await user.click(settingsTab);

    const updatePwdBtn = screen.getByRole('button', { name: /update password/i });
    await user.click(updatePwdBtn);

    expect(await screen.findByText(/please fill out both password fields/i)).toBeInTheDocument();
  });

  it('triggers logout when logout button is clicked', async () => {
    const user = userEvent.setup();
    const mockLogout = vi.fn().mockResolvedValue();
    renderProfile(undefined, mockLogout);

    const logoutBtn = screen.getByRole('button', { name: /log out/i });
    await user.click(logoutBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});

/*
 * The page did not render at all on main.
 *
 * A merge kept the 350 lines of reading-portal JSX and took the top of the
 * file from the version before the portal existed, so every declaration the
 * markup reads — profileData, formName, activeTab, handleLogout, t and
 * seventeen others — was gone, along with six imports and the Profile.css
 * that styles all of it. `ReferenceError: profileData is not defined` on the
 * first render, ErrorBoundary fallback for every signed-in reader. See #366.
 *
 * The six tests above cover the happy paths and would have caught the crash
 * on their own. These are the parts of the restored state layer they do not
 * reach: persistence across a remount, the corrupt-store path, the late
 * session, and the second password rule.
 */
describe('Profile state layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('names the page for the browser tab', () => {
    renderProfile();

    // usePageMetadata was added on the broken side of the merge; it has to
    // survive the restore rather than be reverted with the rest of the head.
    expect(document.title).toBe('Your profile — BookShelf');
  });

  it('reads the saved profile back on a fresh mount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderProfile();

    await user.click(screen.getByRole('button', { name: /⚙️ Account Settings/i }));

    const bio = screen.getByPlaceholderText(/share your reading motto/i);
    await user.clear(bio);
    await user.type(bio, 'Two chapters before bed.');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await screen.findByText(/profile updated successfully!/i);
    unmount();

    // The initialiser reads localStorage rather than an effect doing it after
    // the first paint, so the saved bio is on screen from the first render.
    renderProfile();
    expect(screen.getByText('"Two chapters before bed."')).toBeInTheDocument();
  });

  it('falls back to the defaults when the stored profile is unreadable', () => {
    localStorage.setItem('bookshelf_user_profile', '{ not json');
    const onError = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderProfile();

    // A throw out of a useState initialiser is not recoverable, so the parse
    // has to be guarded rather than left to the ErrorBoundary.
    expect(screen.getByText('Jane Reader')).toBeInTheDocument();
    expect(
      screen.getByText('"A room without books is like a body without a soul."')
    ).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
  });

  it('seeds the name box when the session arrives after the first render', async () => {
    const user = userEvent.setup();
    // GET /api/auth/me resolves after mount, so `user` is null on the render
    // that initialises the form.
    const { rerender } = renderProfile(null);

    await user.click(screen.getByRole('button', { name: /⚙️ Account Settings/i }));
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Reader');

    rerender(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user: { name: 'Jane Reader', email: 'jane@example.com', role: 'Member' },
            isAuthenticated: true,
            loading: false,
            logout: vi.fn(),
            login: vi.fn(),
            register: vi.fn(),
            checkAuth: vi.fn(),
          }}
        >
          <WishlistContext.Provider
            value={{
              wishlist: ['b1', 'b2'],
              loading: false,
              count: 2,
              isWishlisted: () => true,
              toggleWishlist: vi.fn(),
            }}
          >
            <Profile />
          </WishlistContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Reader')
    );
  });

  it('rejects a new password shorter than eight characters', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: /⚙️ Account Settings/i }));

    await user.type(screen.getByLabelText(/current password/i), 'oldsecret1');
    await user.type(screen.getByLabelText(/new password/i), 'short');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(
      await screen.findByText(/at least 8 characters long/i)
    ).toBeInTheDocument();
  });

  it('persists the genres the reader picks', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: /⚙️ Account Settings/i }));

    // Fiction is on by default, so this removes it; Fantasy is not, so this
    // adds it. Both directions go through the same toggle.
    await user.click(screen.getByRole('button', { name: /^Fiction/ }));
    await user.click(screen.getByRole('button', { name: /^Fantasy/ }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await screen.findByText(/profile updated successfully!/i);

    const stored = JSON.parse(localStorage.getItem('bookshelf_user_profile'));
    expect(stored.preferredGenres).not.toContain('Fiction');
    expect(stored.preferredGenres).toContain('Fantasy');
  });

  it('shows the wishlist count from context rather than a copy of it', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(
      screen.getByRole('button', { name: /📖 My Activity/i })
    );

    // Straight from WishlistContext. The library tab is the only place the
    // restored `useWishlist()` call is visible, so it is the only test that
    // would notice if the import went missing again.
    expect(screen.getByText('💖 Wishlist (2)')).toBeInTheDocument();
    expect(screen.getByText(/You currently have 2 books saved/)).toBeInTheDocument();
  });
});
