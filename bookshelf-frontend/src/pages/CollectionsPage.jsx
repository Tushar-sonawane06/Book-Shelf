import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

import {
  getCollections, createCollection, deleteCollection,
  addBookToCollection, removeBookFromCollection,
} from '../services/collectionService.js';
import { getBooksByIds } from '../services/bookService.js';
import { usePageMetadata } from '../hooks/usePageMetadata.js';
import './CollectionsPage.css';

/**
 * CollectionsPage — manage named book lists.
 *
 * Left panel: list of collections with create/delete. Right panel: books
 * in the selected collection with an "Add Book" search to expand it.
 */
export default function CollectionsPage() {
  /*
   * The page had no route, so it also had no title — the browser tab kept
   * whatever the previous route set. See #337 for the rest of the pages and
   * #421 for why this one was missed.
   */
  usePageMetadata({
    title: 'My collections',
    description: 'Group the books you care about into named lists.',
  });

  const [collections, setCollections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [searchId, setSearchId] = useState('');
  const [error, setError] = useState('');

  // ── Fetch all collections ──────────────────────────────────────────

  /*
   * `selectedId` was a dependency of this callback while the effect below ran
   * with `[]`, so the effect captured the first version forever — the
   * dependency did nothing except make the two disagree about when this
   * should be rebuilt. The selection is chosen with a functional update
   * instead, which needs no dependency at all.
   */
  const fetchCollections = useCallback(async (signal) => {
    try {
      const data = await getCollections({ signal });
      setCollections(data);
      setSelectedId((current) => current ?? data[0]?.id ?? null);
    } catch (err) {
      // An abort is not a failure — the page is unmounting.
      if (err?.code !== 'ERR_CANCELED') {
        setError(err.message || 'Failed to load collections');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const c = new AbortController();
    fetchCollections(c.signal);
    return () => c.abort();
  }, [fetchCollections]);

  // ── Fetch books when collection changes ────────────────────────────

  /*
   * Keyed on the ids themselves rather than on the `collections` array.
   *
   * `collections` gets a new identity on every state update — including the
   * ones this page makes after adding or removing a book, which already
   * update `books` locally — so depending on it refetched the whole
   * collection from the catalogue after every mutation. The joined ids are a
   * string, so a change of selection or of contents refetches and nothing
   * else does. Same reasoning as useBooksByIds.
   */
  const selectedBookIds = useMemo(() => {
    const col = collections.find((c) => c.id === selectedId);
    return Array.isArray(col?.bookIds) ? col.bookIds : [];
  }, [collections, selectedId]);

  const bookIdKey = selectedBookIds.join(',');

  useEffect(() => {
    const ids = bookIdKey ? bookIdKey.split(',') : [];
    if (ids.length === 0) { setBooks([]); return undefined; }

    const c = new AbortController();
    getBooksByIds(ids, { signal: c.signal })
      .then(({ books: b }) => setBooks(b))
      .catch(() => setBooks([]));
    return () => c.abort();
  }, [bookIdKey]);

  // ── Create ─────────────────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { collection } = await createCollection({ name: newName.trim() });
      setCollections((prev) => [collection, ...prev]);
      setSelectedId(collection.id);
      setNewName('');
      setCreating(false);
    } catch (err) {
      setError(err.message || 'Failed to create');
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────

  const handleDelete = async (id) => {
    try {
      await deleteCollection(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete');
    }
  };

  // ── Add book ───────────────────────────────────────────────────────

  const handleAddBook = async () => {
    if (!searchId.trim() || !selectedId) return;
    try {
      await addBookToCollection(selectedId, searchId.trim());
      setCollections((prev) =>
        prev.map((c) =>
          c.id === selectedId ? { ...c, bookIds: [...c.bookIds, searchId.trim()] } : c
        )
      );
      setSearchId('');
    } catch (err) {
      if (err.status !== 409) setError(err.message || 'Failed to add book');
    }
  };

  // ── Remove book ────────────────────────────────────────────────────

  const handleRemoveBook = async (bookId) => {
    try {
      await removeBookFromCollection(selectedId, bookId);
      setCollections((prev) =>
        prev.map((c) =>
          c.id === selectedId ? { ...c, bookIds: c.bookIds.filter((id) => id !== bookId) } : c
        )
      );
      setBooks((prev) => prev.filter((b) => String(b.id) !== String(bookId)));
    } catch (err) {
      setError(err.message || 'Failed to remove book');
    }
  };

  const selected = collections.find((c) => c.id === selectedId);

  return (
    <main className="collections-page">
      <h1 className="collections-page__title">My Collections</h1>

      {error && <div className="collections-page__error">{error}<button onClick={() => setError('')}>✕</button></div>}

      <div className="collections-page__layout">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className="collections-page__sidebar">
          <button
            className="collections-page__add-btn"
            onClick={() => setCreating(!creating)}
          >
            + New Collection
          </button>

          {creating && (
            <form className="collections-page__create-form" onSubmit={handleCreate}>
              <input
                autoFocus
                placeholder="Collection name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={80}
              />
              <button type="submit">Create</button>
            </form>
          )}

          {loading && <p className="collections-page__loading">Loading…</p>}

          {!loading && collections.length === 0 && (
            <p className="collections-page__empty">
              No collections yet. Create one to organize your books!
            </p>
          )}

          <ul className="collections-page__list">
            {collections.map((col) => (
              <li
                key={col.id}
                className={`collections-page__item ${col.id === selectedId ? 'collections-page__item--active' : ''}`}
              >
                <button
                  className="collections-page__item-btn"
                  onClick={() => setSelectedId(col.id)}
                >
                  <span className="collections-page__item-name">{col.name}</span>
                  <span className="collections-page__item-count">{col.bookIds.length}</span>
                </button>
                <button
                  className="collections-page__item-delete"
                  onClick={() => handleDelete(col.id)}
                  title="Delete collection"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Main content ────────────────────────────────────────── */}
        <section className="collections-page__content">
          {!selected && !loading && (
            <p className="collections-page__no-select">
              Select a collection or create a new one.
            </p>
          )}

          {selected && (
            <>
              <h2 className="collections-page__col-title">{selected.name}</h2>

              <div className="collections-page__add-row">
                <input
                  placeholder="Add book by ID…"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                />
                <button onClick={handleAddBook} disabled={!searchId.trim()}>Add</button>
              </div>

              {books.length === 0 && (
                <p className="collections-page__empty-books">
                  This collection is empty. Add books using the field above.
                </p>
              )}

              <ul className="collections-page__books">
                {books.map((book) => (
                  <li key={book.id} className="collections-page__book">
                    <Link to={`/book/${book.id}`} className="collections-page__book-link">
                      <span className="collections-page__book-title">{book.title}</span>
                      <span className="collections-page__book-author">{book.author}</span>
                    </Link>
                    <button
                      className="collections-page__book-remove"
                      onClick={() => handleRemoveBook(book.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
