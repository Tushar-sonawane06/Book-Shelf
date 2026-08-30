import bookRepository from '../repositories/bookRepository.js';

/**
 * Maximum number of books that can be compared at once.
 * Keeps the payload bounded and the UI usable on small screens.
 */
const MAX_COMPARE = 5;

/**
 * Fields to include in the comparison response.
 * Kept explicit so the endpoint does not leak internal fields like `__v`.
 */
const COMPARISON_FIELDS = [
  'id',
  'title',
  'author',
  'genre',
  'price',
  'rating',
  'reviewsCount',
  'inventory',
  'description',
  'coverImage',
  'pages',
  'cover',
  'year',
  'isbn',
];

// ── Get comparison data for multiple books ──────────────────────────────────

/**
 * @desc    Get structured comparison data for a set of books
 * @route   GET /api/books/compare?ids=b1,b2,b3
 * @access  Public
 *
 * Returns books in the same order as the requested ids, with each book's
 * fields normalised for comparison. Missing ids are reported separately
 * so the frontend can tell the user which books could not be loaded.
 */
export const getComparison = (req, res, next) => {
  try {
    const rawIds = req.query.ids;

    if (!rawIds || typeof rawIds !== 'string') {
      return res.status(400).json({
        message: 'ids query parameter is required (comma-separated book ids)',
      });
    }

    const ids = rawIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) {
      return res.status(400).json({ message: 'At least one book id is required' });
    }

    if (ids.length > MAX_COMPARE) {
      return res.status(400).json({
        message: `Maximum ${MAX_COMPARE} books can be compared at once`,
      });
    }

    const allBooks = bookRepository.getBooks();
    const bookMap = new Map(allBooks.map((b) => [String(b.id), b]));

    const books = [];
    const missingIds = [];

    for (const id of ids) {
      const book = bookMap.get(id);
      if (!book) {
        missingIds.push(id);
        continue;
      }

      const normalised = {};
      for (const field of COMPARISON_FIELDS) {
        normalised[field] = book[field] ?? null;
      }
      books.push(normalised);
    }

    // Compute comparison metadata
    const prices = books.map((b) => b.price).filter((p) => typeof p === 'number');
    const ratings = books.map((b) => b.rating).filter((r) => typeof r === 'number');

    const meta = {
      count: books.length,
      priceRange:
        prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : null,
      averageRating:
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null,
      genres: [...new Set(books.map((b) => b.genre).filter(Boolean))],
    };

    res.json({ books, missingIds, meta });
  } catch (error) {
    next(error);
  }
};

export default { getComparison };
