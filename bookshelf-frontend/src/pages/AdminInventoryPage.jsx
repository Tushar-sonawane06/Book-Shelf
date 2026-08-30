import React, { useEffect, useState, useCallback } from 'react';
import {
  getBooks,
  createBook,
  updateBook,
  deleteBook,
  updateBookStock,
  getGenres,
} from '../services/bookService.js';
import AdminAnalytics from '../components/AdminAnalytics.jsx';
import BulkUpload from '../components/BulkUpload.jsx';
import UserTable from '../components/UserTable.jsx';
import LibraryManagementSystem from '../components/LibraryManagementSystem.jsx';
import { usePageMetadata } from '../hooks/usePageMetadata.js';
import './AdminInventoryPage.css';

export default function AdminInventoryPage() {
  usePageMetadata({
    title: 'Admin Management & Inventory',
    description: 'Manage book inventory, upload stock, edit catalog details, and view store metrics.',
  });

  const [books, setBooks] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    genre: 'Fiction',
    price: '',
    inventory: 10,
    rating: 4.5,
    description: '',
    pages: 300,
    cover: '#1E3A8A',
  });

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedGenre) params.genre = selectedGenre;

      const data = await getBooks(params);
      setBooks(data?.books ?? []);
    } catch (err) {
      console.error('Failed to load inventory:', err);
      setError(err?.message || 'Failed to load catalog inventory from server.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedGenre]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    getGenres()
      .then((data) => setGenres(data))
      .catch(() => setGenres([]));
  }, []);

  const showToast = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(null), 4000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Stock mutation (PATCH /api/books/:id/stock)
  const handleStockChange = async (bookId, currentStock, delta) => {
    const newStock = Math.max(0, currentStock + delta);
    try {
      await updateBookStock(bookId, { inventory: newStock });
      setBooks((prev) =>
        prev.map((b) => (b.id === bookId ? { ...b, inventory: newStock } : b))
      );
      showToast(`Updated stock for book ID ${bookId} to ${newStock}`);
    } catch (err) {
      showToast(err?.message || 'Failed to update stock', true);
    }
  };

  // Delete mutation (DELETE /api/books/:id)
  const handleDeleteBook = async (bookId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteBook(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      showToast(`Successfully deleted "${title}"`);
    } catch (err) {
      showToast(err?.message || 'Failed to delete book', true);
    }
  };

  // Open Edit Modal
  const openEditModal = (book) => {
    setEditingBook(book);
    setFormData({
      title: book.title || '',
      author: book.author || '',
      genre: book.genre || 'Fiction',
      price: book.price || '',
      inventory: book.inventory ?? 10,
      rating: book.rating || 4.5,
      description: book.description || '',
      pages: book.pages || 300,
      cover: book.cover || '#1E3A8A',
    });
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingBook(null);
    setFormData({
      title: '',
      author: '',
      genre: genres[0] || 'Fiction',
      price: '',
      inventory: 10,
      rating: 4.5,
      description: '',
      pages: 300,
      cover: '#1E3A8A',
    });
    setIsAddModalOpen(true);
  };

  // Save (Create or Update)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      title: formData.title.trim(),
      author: formData.author.trim(),
      genre: formData.genre.trim(),
      price: Number(formData.price),
      inventory: Number(formData.inventory),
      rating: Number(formData.rating),
      description: formData.description.trim(),
      pages: Number(formData.pages),
      cover: formData.cover,
    };

    try {
      if (editingBook) {
        await updateBook(editingBook.id, payload);
        showToast(`Successfully updated "${payload.title}"`);
      } else {
        await createBook(payload);
        showToast(`Successfully added new book "${payload.title}"`);
      }
      setIsAddModalOpen(false);
      setEditingBook(null);
      fetchCatalog();
    } catch (err) {
      showToast(err?.message || 'Failed to save book record', true);
    }
  };

  return (
    <main className="admin-page">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header__title">
          <h1>🛠️ Admin Dashboard & Inventory System</h1>
          <p className="admin-header__subtitle">
            Complete store overview, batch catalog operations, and inventory control.
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn--primary" onClick={openAddModal}>
          ➕ Add New Book Listing
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="admin-alert admin-alert--success" role="alert">
          ✓ {successMessage}
        </div>
      )}
      {error && (
        <div className="admin-alert admin-alert--error" role="alert">
          ⚠️ {error}
        </div>
      )}

      {/* Analytics Overview */}
      <section style={{ marginBottom: '32px' }}>
        <AdminAnalytics />
      </section>

      {/* Live Inventory & CRUD Management */}
      <section className="admin-section">
        <div className="admin-section__header">
          <h2 className="admin-section__title">📦 Store Catalog Inventory ({books.length})</h2>
          <div className="admin-controls">
            <input
              type="text"
              placeholder="Search title or author..."
              className="admin-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="admin-select-filter"
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
            >
              <option value="">All Genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <button type="button" className="admin-btn admin-btn--secondary" onClick={fetchCatalog}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-soft)' }}>
            Loading catalog inventory...
          </p>
        ) : books.length === 0 ? (
          <p style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-soft)' }}>
            No books found matching criteria.
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Title & Author</th>
                  <th>Genre</th>
                  <th>Price</th>
                  <th>Stock Inventory</th>
                  <th>Rating</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => {
                  const stock = b.inventory ?? 0;
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="admin-book-cover" style={{ background: b.cover || '#1e293b' }}>
                          {b.genre || 'Book'}
                        </div>
                      </td>
                      <td>
                        <strong>{b.title}</strong>
                        <br />
                        <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>by {b.author}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>
                          {b.genre}
                        </span>
                      </td>
                      <td>₹{b.price}</td>
                      <td>
                        <div className="admin-stock-control">
                          <button
                            type="button"
                            className="admin-stock-btn"
                            onClick={() => handleStockChange(b.id, stock, -1)}
                            disabled={stock <= 0}
                            title="Decrease Stock"
                          >
                            -
                          </button>
                          <span
                            className={`admin-stock-badge ${
                              stock > 5 ? 'admin-stock-badge--in' : stock > 0 ? 'admin-stock-badge--low' : 'admin-stock-badge--out'
                            }`}
                          >
                            {stock} {stock === 0 ? '(Out of stock)' : ''}
                          </span>
                          <button
                            type="button"
                            className="admin-stock-btn"
                            onClick={() => handleStockChange(b.id, stock, 1)}
                            title="Increase Stock"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>★ {b.rating || 'N/A'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="admin-btn admin-btn--secondary admin-btn--sm"
                            onClick={() => openEditModal(b)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger admin-btn--sm"
                            onClick={() => handleDeleteBook(b.id, b.title)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit Modal */}
      {(isAddModalOpen || editingBook) && (
        <div className="admin-modal-backdrop" onClick={() => { setIsAddModalOpen(false); setEditingBook(null); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-modal__title">
              {editingBook ? `✏️ Edit Book #${editingBook.id}` : '➕ Add New Book Listing'}
            </h3>
            <form onSubmit={handleFormSubmit}>
              <div className="admin-form-grid">
                <div className="admin-form-group admin-form-group--full">
                  <label htmlFor="modal-title">Book Title</label>
                  <input
                    id="modal-title"
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="modal-author">Author</label>
                  <input
                    id="modal-author"
                    type="text"
                    required
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="modal-genre">Genre</label>
                  <input
                    id="modal-genre"
                    type="text"
                    required
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="modal-price">Price (₹)</label>
                  <input
                    id="modal-price"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="modal-inventory">Stock Inventory</label>
                  <input
                    id="modal-inventory"
                    type="number"
                    min="0"
                    required
                    value={formData.inventory}
                    onChange={(e) => setFormData({ ...formData, inventory: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="modal-rating">Rating (0 to 5)</label>
                  <input
                    id="modal-rating"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="modal-pages">Pages</label>
                  <input
                    id="modal-pages"
                    type="number"
                    min="1"
                    value={formData.pages}
                    onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                  />
                </div>

                <div className="admin-form-group admin-form-group--full">
                  <label htmlFor="modal-description">Description</label>
                  <textarea
                    id="modal-description"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="admin-form-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => { setIsAddModalOpen(false); setEditingBook(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary">
                  {editingBook ? 'Save Changes' : 'Create Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Library Management System */}
      <section style={{ marginBottom: '32px' }}>
        <LibraryManagementSystem books={books.slice(0, 4)} />
      </section>

      {/* Batch Operations & User Management */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Batch Operations</h2>
          <BulkUpload />
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>User Roster</h2>
          <UserTable />
        </div>
      </div>
    </main>
  );
}
