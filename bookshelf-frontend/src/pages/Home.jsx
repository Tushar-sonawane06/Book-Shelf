import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Hero from '../components/Hero.jsx';
import FilterSidebar from '../components/FilterSidebar.jsx';
import BookCard from '../components/BookCard.jsx';
import Pagination from '../components/Pagination.jsx';
import SkeletonLoader from '../components/SkeletonLoader.jsx';
import { useBookCatalog } from '../hooks/useBookCatalog.js';
import { useCatalogFilters } from '../hooks/useCatalogFilters.js';
import { hasActiveFilters } from '../utils/catalogQuery.js';
import { currencySymbol } from '../utils/currency.js';
import { usePageMetadata } from '../hooks/usePageMetadata.js';

// Genre list is static because the catalogue is. GET /api/books/genres
// exists and returns these with counts; wiring it up is a separate change.
const ALL_GENRES = ['All', 'Fiction', 'Sci-Fi', 'Mystery', 'Self-Help', 'Poetry'];

const PAGE_SIZE = 4;

import BookCarousel from '../components/BookCarousel.jsx';
import FilterChips from '../components/FilterChips.jsx';
import QuickActionButtons from '../components/QuickActionButtons.jsx';
import { useCart } from '../hooks/useCart.js';

export default function Home({ searchQuery: searchQueryProp }) {
  const { t } = useTranslation();
  const { addToCart } = useCart();

  const { filters, setGenre, setMinPrice, setMaxPrice, setMinRating, setSort, setPage, setSearch, clearFilters } =
    useCatalogFilters();

  const outletContext = useOutletContext();
  const setSearchQuery = outletContext?.setSearchQuery;
  const searchQuery = searchQueryProp ?? outletContext?.searchQuery ?? '';

  const hydrated = useRef(false);
  const lastTyped = useRef(searchQuery);

  useEffect(() => {
    if (hydrated.current) {
      return;
    }

    hydrated.current = true;

    if (filters.search !== '' && filters.search !== searchQuery && setSearchQuery) {
      lastTyped.current = filters.search;
      setSearchQuery(filters.search);
    }
  }, [filters.search, searchQuery, setSearchQuery]);

  useEffect(() => {
    if (searchQuery === lastTyped.current) {
      return;
    }

    lastTyped.current = searchQuery;
    setSearch(searchQuery.trim());
  }, [searchQuery, setSearch]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const symbol = currencySymbol();

  const catalogFilters = useMemo(
    () => ({
      search: filters.search,
      genres: filters.genres,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      minRating: filters.minRating,
      sort: filters.sort,
      page: filters.page,
      limit: PAGE_SIZE,
    }),
    [
      filters.search,
      filters.genres,
      filters.minPrice,
      filters.maxPrice,
      filters.minRating,
      filters.sort,
      filters.page,
    ]
  );

  const { books, totalBooks, totalPages, loading, error, reload } =
    useBookCatalog(catalogFilters);

  usePageMetadata({
    title: searchQuery.trim() === '' ? null : `${searchQuery.trim()} — search results`,
    description: null,
  });

  const filtersActive = hasActiveFilters({
    genres: filters.genres,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
  });

  const handlePageChange = (page) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const genreOptions = ALL_GENRES.filter((g) => g !== 'All').map((g) => ({
    label: g,
    value: g,
  }));

  return (
    <>
      <Hero />

      <main className="catalog" id="catalog">
        <div className="catalog__inner">

          <div className="catalog__header">
            <h2 className="catalog__title">{t('home.featuredTitle')}</h2>
            <p className="catalog__count">
              {t('home.titlesTotal', { count: totalBooks })}
            </p>
          </div>

          <div className="catalog__layout">

            <FilterSidebar
              genres={ALL_GENRES}
              selectedGenres={filters.genres}
              onGenreChange={setGenre}
              minPrice={filters.minPrice}
              onMinPriceChange={setMinPrice}
              maxPrice={filters.maxPrice}
              onMaxPriceChange={setMaxPrice}
              minRating={filters.minRating}
              onMinRatingChange={setMinRating}
              onClearFilters={clearFilters}
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen((open) => !open)}
            />

            <div className="catalog__grid-container">

              <div className="catalog__controls">
                <select
                  id="sort-select"
                  className="catalog__sort-select"
                  value={filters.sort}
                  onChange={(event) => setSort(event.target.value)}
                  aria-label={t('home.sortAriaLabel')}
                >
                  <option value="">{t('home.sortDefault')}</option>
                  <option value="price_asc">{t('home.sortPriceAsc')}</option>
                  <option value="price_desc">{t('home.sortPriceDesc')}</option>
                  <option value="rating_desc">{t('home.sortRatingDesc')}</option>
                  <option value="title_asc">{t('home.sortTitleAsc')}</option>
                </select>
              </div>

              {filtersActive && (
                <div className="catalog__filter-summary">
                  <span>Active filters:</span>
                  {filters.genres.map((genre) => (
                    <span key={genre} className="catalog__filter-tag">
                      {genre}
                      <button
                        onClick={() => setGenre(genre, false)}
                        aria-label={`Remove ${genre} filter`}
                      >✕</button>
                    </span>
                  ))}
                  {filters.minPrice !== '' && (
                    <span className="catalog__filter-tag">
                      Min {symbol}{filters.minPrice}
                      <button onClick={() => setMinPrice('')} aria-label="Remove min price filter">✕</button>
                    </span>
                  )}
                  {filters.maxPrice !== '' && (
                    <span className="catalog__filter-tag">
                      Max {symbol}{filters.maxPrice}
                      <button onClick={() => setMaxPrice('')} aria-label="Remove max price filter">✕</button>
                    </span>
                  )}
                  {filters.minRating !== null && (
                    <span className="catalog__filter-tag">
                      {'★'.repeat(filters.minRating)} & up
                      <button onClick={() => setMinRating(null)} aria-label="Remove rating filter">✕</button>
                    </span>
                  )}
                  <button className="catalog__filter-tag" onClick={clearFilters}>
                    Clear all ✕
                  </button>
                </div>
              )}

              {loading ? (
                <div className="catalog__grid">
                  <SkeletonLoader variant="card" count={PAGE_SIZE} />
                </div>
              ) : error ? (
                <div className="catalog__empty">
                  <h3>{t('home.errorLoading')}</h3>
                  <p className="catalog__error-detail">{error}</p>
                  <button className="catalog__empty-btn" onClick={reload}>
                    Try again
                  </button>
                </div>
              ) : books.length === 0 ? (
                <div className="catalog__empty">
                  <h3>{t('home.noBooksFound')}</h3>
                  {filtersActive && (
                    <button className="catalog__empty-btn" onClick={clearFilters}>
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="catalog__grid">
                    {books.map((book) => (
                      <BookCard key={book.id} book={book} />
                    ))}
                  </div>
                  {/* totalPages describes the filtered set now, so the pager
                      no longer offers pages that render empty. */}
                  <Pagination
                    currentPage={filters.page}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </>
              )}

            </div>{/* end .catalog__grid-container */}
          </div>{/* end .catalog__layout */}
        </div>
      </main>
    </>
  );
}
