import { useMemo } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const getBookById = vi.fn();
const getBooks = vi.fn();

vi.mock('../services/bookService.js', async () => {
  const actual = await vi.importActual('../services/bookService.js');
  return {
    ...actual,
    getBookById: (...args) => getBookById(...args),
    getBooks: (...args) => getBooks(...args),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: () => '' }),
}));

vi.mock('../components/SkeletonLoader.jsx', () => ({
  default: () => <div data-testid="skeleton" />,
}));

/*
 * ReviewList reports a fresh id on every mount, so a test can tell a remount
 * from a re-render. BookDetail keys it on `reviewKey` precisely to force one.
 */
let reviewListMounts = 0;
vi.mock('../components/ReviewList.jsx', () => ({
  default: () => {
    const id = useMemo(() => {
      reviewListMounts += 1;
      return reviewListMounts;
    }, []);
    return <div data-testid="review-list" data-mount={String(id)} />;
  },
}));

const createReview = vi.fn();
const getMyReview = vi.fn();

vi.mock('../services/reviewService.js', () => ({
  createReview: (...args) => createReview(...args),
  getMyReview: (...args) => getMyReview(...args),
}));

import { BookNotFoundError } from '../services/bookService.js';
import { CartProvider } from '../context/CartContext.jsx';
import { WishlistContext } from '../context/WishlistContext.jsx';
import BookDetail from './BookDetail.jsx';

const wishlist = {
  wishlist: [],
  loading: false,
  count: 0,
  isWishlisted: () => false,
  toggleWishlist: vi.fn(),
};

const BOOK = {
  id: 'b1',
  title: 'The Quiet Ones',
  author: 'M. Arora',
  genre: 'Fiction',
  price: 349,
  rating: 4.5,
  cover: '#7A2E2E',
  inventory: 8,
};

function renderDetail(bookId = 'b1') {
  window.localStorage.clear();

  return render(
    <MemoryRouter initialEntries={[`/book/${bookId}`]}>
      <WishlistContext.Provider value={wishlist}>
        <CartProvider>
          <Routes>
            <Route path="/book/:id" element={<BookDetail />} />
            <Route path="/" element={<h1>home</h1>} />
          </Routes>
        </CartProvider>
      </WishlistContext.Provider>
    </MemoryRouter>
  );
}

describe('BookDetail', () => {
  beforeEach(() => {
    getBookById.mockReset();
    getBooks.mockReset();
    getBooks.mockResolvedValue({ books: [] });
    createReview.mockReset();
    getMyReview.mockReset();
    // 404 for "you have not reviewed this book yet" is the normal case.
    getMyReview.mockRejectedValue(new Error('not found'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the book from the API, not the hardcoded frontend copy', async () => {
    // A price that differs from src/data/books.js proves which source won.
    getBookById.mockResolvedValue({ ...BOOK, price: 999 });

    renderDetail('b1');

    expect(await screen.findByRole('heading', { name: 'The Quiet Ones' })).toBeInTheDocument();
    expect(getBookById).toHaveBeenCalledWith('b1', expect.anything());
    expect(screen.getByText('₹999')).toBeInTheDocument();
    expect(screen.queryByText('₹349')).not.toBeInTheDocument();
  });

  it('shows a real skeleton while the request is in flight, not a 700ms timer', () => {
    getBookById.mockReturnValue(new Promise(() => {}));

    renderDetail('b1');

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('renders a book the local copy has never heard of', async () => {
    getBookById.mockResolvedValue({
      ...BOOK,
      id: 'b9',
      title: 'A Ninth Book',
    });

    renderDetail('b9');

    expect(await screen.findByRole('heading', { name: 'A Ninth Book' })).toBeInTheDocument();
  });

  it('says "not found" only for a genuine 404', async () => {
    getBookById.mockRejectedValue(new BookNotFoundError('b99'));

    renderDetail('b99');

    expect(await screen.findByRole('heading', { name: /book not found/i })).toBeInTheDocument();
  });

  it('offers a retry rather than "not found" when the request failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getBookById.mockRejectedValueOnce({ status: 500, message: 'Server error' });
    getBookById.mockResolvedValueOnce(BOOK);

    const user = userEvent.setup();
    renderDetail('b1');

    expect(await screen.findByRole('heading', { name: /could not load/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /book not found/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('heading', { name: 'The Quiet Ones' })).toBeInTheDocument();
  });

  it('shows stock, which the local copy does not carry at all', async () => {
    getBookById.mockResolvedValue({ ...BOOK, inventory: 2 });

    renderDetail('b1');

    expect(await screen.findByText('Only 2 left')).toBeInTheDocument();
  });

  it('refuses to add a sold-out book to the cart', async () => {
    getBookById.mockResolvedValue({ ...BOOK, inventory: 0 });

    renderDetail('b1');

    const button = await screen.findByRole('button', { name: /out of stock/i });
    expect(button).toBeDisabled();
    expect(screen.getByText('Out of stock', { selector: 'span' })).toBeInTheDocument();
  });

  it('renders a book with no rating instead of throwing on toFixed', async () => {
    // eslint-disable-next-line no-unused-vars -- destructured to drop it
    const { rating: _rating, ...withoutRating } = BOOK;
    getBookById.mockResolvedValue(withoutRating);

    renderDetail('b1');

    expect(await screen.findByRole('heading', { name: 'The Quiet Ones' })).toBeInTheDocument();
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it('asks the API for related books in the same genre', async () => {
    getBookById.mockResolvedValue(BOOK);
    getBooks.mockResolvedValue({
      books: [BOOK, { ...BOOK, id: 'b7', title: 'Another Fiction' }],
    });

    renderDetail('b1');

    await waitFor(() =>
      expect(getBooks).toHaveBeenCalledWith(
        { genre: 'Fiction', limit: 5 },
        expect.anything()
      )
    );

    // BookCard prints the title on the cover and again in the body, so this
    // is a findAll rather than a findBy.
    expect((await screen.findAllByText('Another Fiction')).length).toBeGreaterThan(0);

    // The book being viewed is excluded from its own related list.
    const relatedGrid = document.querySelector('.book-related-grid');
    expect(within(relatedGrid).queryByText('The Quiet Ones')).not.toBeInTheDocument();
  });

  it('still renders the book when related books fail to load', async () => {
    getBookById.mockResolvedValue(BOOK);
    getBooks.mockRejectedValue({ status: 500, message: 'nope' });

    renderDetail('b1');

    expect(await screen.findByRole('heading', { name: 'The Quiet Ones' })).toBeInTheDocument();
  });

  describe('the document title', () => {
    /**
     * Every route in the app used to render "BookShelf — Find your next
     * read". A screen reader announced the same page name on every
     * navigation, browser history was N identical entries, and ShareButton —
     * which defaults its share title to `document.title` — had nothing better
     * to attach to a specific book's URL. See #337.
     */
    it('names the book and its author once it has loaded', async () => {
      getBookById.mockResolvedValue(BOOK);

      renderDetail();

      await waitFor(() =>
        expect(document.title).toBe('The Quiet Ones by M. Arora — BookShelf')
      );
    });

    it('leaves the site default in place while the book is loading', () => {
      getBookById.mockReturnValue(new Promise(() => {}));

      renderDetail();

      // Not "— BookShelf" with a dangling separator, and not the previous
      // book's name either.
      expect(document.title).toBe('BookShelf — Find your next read');
    });

    it('says so for a 404 rather than titling the page after a book that is not there', async () => {
      getBookById.mockRejectedValue(new BookNotFoundError('nope'));

      renderDetail('nope');

      await waitFor(() =>
        expect(document.title).toBe('Book not found — BookShelf')
      );
    });

    it('describes the book for a link preview', async () => {
      getBookById.mockResolvedValue(BOOK);

      renderDetail();

      await waitFor(() => {
        const description = document
          .querySelector('meta[name="description"]')
          ?.getAttribute('content');

        expect(description).toContain('The Quiet Ones');
        expect(description).toContain('M. Arora');
        expect(description).toContain('Fiction');
      });
    });
  });

  it('requires a star rating before a review can be submitted', async () => {
    getBookById.mockResolvedValue(BOOK);
    const user = userEvent.setup();

    renderDetail('b1');
    await screen.findByRole('heading', { name: 'The Quiet Ones' });

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/select a rating/i)).toBeInTheDocument();
  });

  /*
   * The hook order, directly.
   *
   * `useState` for `reviewKey` sat below the loading, not-found and error
   * returns. Every one of the tests above went through the loading render
   * first and so tripped it, which is why eleven of fifteen were failing at
   * once — but they each report it as whatever assertion happened to run
   * after the throw. These say what the defect actually is, so a regression
   * names itself.
   */
  describe('hook order', () => {
    /** Renders and returns whatever React logged as an error. */
    async function renderAndCollectErrors(setup) {
      const logged = [];
      vi.spyOn(console, 'error').mockImplementation((...args) => {
        logged.push(args.map(String).join(' '));
      });

      setup();
      const view = renderDetail('b1');
      await waitFor(() => expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument());

      return { logged, view };
    }

    it('runs the same hooks on the loading render and the loaded render', async () => {
      const { logged } = await renderAndCollectErrors(() => {
        getBookById.mockResolvedValue(BOOK);
      });

      expect(logged.join('\n')).not.toMatch(/Rendered more hooks/);
      expect(screen.getByRole('heading', { name: 'The Quiet Ones' })).toBeInTheDocument();
    });

    it('runs the same hooks when the book is not found', async () => {
      const { logged } = await renderAndCollectErrors(() => {
        getBookById.mockRejectedValue(new BookNotFoundError('nope'));
      });

      expect(logged.join('\n')).not.toMatch(/Rendered more hooks/);
    });

    it('runs the same hooks when the request fails', async () => {
      const { logged } = await renderAndCollectErrors(() => {
        getBookById.mockRejectedValue(new Error('network down'));
      });

      expect(logged.join('\n')).not.toMatch(/Rendered more hooks/);
    });
  });

  it('remounts the review list after a review is posted', async () => {
    // This is the whole reason reviewKey exists, and nothing covered it —
    // which is part of why the hook could sit in an illegal position for as
    // long as it did.
    getBookById.mockResolvedValue(BOOK);
    createReview.mockResolvedValue({ review: { id: 'r1' } });
    const user = userEvent.setup();

    renderDetail('b1');
    await screen.findByRole('heading', { name: 'The Quiet Ones' });

    const before = screen.getByTestId('review-list').getAttribute('data-mount');

    await user.click(screen.getByRole('button', { name: '4 Stars' }));
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(createReview).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('review-list').getAttribute('data-mount')).not.toBe(before)
    );
  });
});
