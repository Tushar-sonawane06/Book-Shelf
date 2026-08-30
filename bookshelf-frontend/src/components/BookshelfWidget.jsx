import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useReadingList } from '../hooks/useReadingList.js';
import './BookshelfWidget.css';

const SHELF_OPTIONS = [
  { value: 'want-to-read', label: '📚 Want to Read', color: '#6366f1' },
  { value: 'currently-reading', label: '📖 Currently Reading', color: '#f59e0b' },
  { value: 'finished', label: '✅ Finished', color: '#10b981' },
];

/**
 * Compact reading-list widget for the book detail page.
 *
 * Shows a shelf picker, optional progress slider (only for "Currently
 * Reading"), a notes field, and a remove button. All changes persist
 * immediately through the reading list API.
 */
export default function BookshelfWidget({ bookId }) {
  const { user } = useAuth();
  const { checkBook, addBook, update, removeBook } = useReadingList();

  const [onList, setOnList] = useState(false);
  const [entry, setEntry] = useState(null);
  const [shelf, setShelf] = useState('want-to-read');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Check on mount / bookId change
  useEffect(() => {
    if (!user || !bookId) return;
    let cancelled = false;
    checkBook(bookId).then((data) => {
      if (cancelled) return;
      setOnList(data.onList);
      if (data.entry) {
        setEntry(data.entry);
        setShelf(data.entry.shelf);
        setNotes(data.entry.notes || '');
        setProgress(data.entry.progress ?? 0);
      }
    });
    return () => { cancelled = true; };
  }, [bookId, user, checkBook]);

  const flash = useCallback((msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }, []);

  async function handleShelfChange(newShelf) {
    if (busy) return;
    setBusy(true);
    try {
      if (!onList) {
        const data = await addBook(bookId, newShelf, { notes });
        setOnList(true);
        setEntry(data.entry);
        setShelf(newShelf);
        flash(`Added to "${newShelf}"`);
      } else {
        const data = await update(entry.id, { shelf: newShelf });
        setEntry(data.entry);
        setShelf(newShelf);
        flash(`Moved to "${newShelf}"`);
      }
    } catch (err) {
      flash(err?.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  async function handleProgressChange(value) {
    setProgress(value);
    if (entry && shelf === 'currently-reading') {
      try {
        const data = await update(entry.id, { progress: value });
        setEntry(data.entry);
      } catch {
        // silent — slider is best-effort
      }
    }
  }

  async function handleNotesBlur() {
    if (entry && onList) {
      try {
        await update(entry.id, { notes });
      } catch {
        // silent
      }
    }
  }

  async function handleRemove() {
    if (busy) return;
    setBusy(true);
    try {
      await removeBook(bookId);
      setOnList(false);
      setEntry(null);
      setShelf('want-to-read');
      setNotes('');
      setProgress(0);
      setExpanded(false);
      flash('Removed from reading list');
    } catch (err) {
      flash(err?.message || 'Failed to remove');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="bookshelf-widget bookshelf-widget--logged-out">
        <p>Log in to add this book to your reading list.</p>
      </div>
    );
  }

  const activeColor = SHELF_OPTIONS.find((s) => s.value === shelf)?.color || '#6366f1';

  return (
    <div className="bookshelf-widget">
      {message && (
        <div className="bookshelf-widget__toast" role="status">
          {message}
        </div>
      )}

      {/* Shelf picker */}
      <div className="bookshelf-widget__shelves">
        {SHELF_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`bookshelf-widget__shelf-btn ${shelf === opt.value ? 'bookshelf-widget__shelf-btn--active' : ''}`}
            style={shelf === opt.value ? { borderColor: opt.color, background: `${opt.color}10` } : {}}
            onClick={() => handleShelfChange(opt.value)}
            disabled={busy}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Expand toggle */}
      {onList && (
        <button
          type="button"
          className="bookshelf-widget__expand-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '▲ Less' : '▼ More options'}
        </button>
      )}

      {/* Expanded options */}
      {expanded && onList && (
        <div className="bookshelf-widget__details">
          {/* Progress slider */}
          {shelf === 'currently-reading' && (
            <div className="bookshelf-widget__progress">
              <label htmlFor="reading-progress">
                Progress: <strong>{progress}%</strong>
              </label>
              <input
                id="reading-progress"
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => handleProgressChange(Number(e.target.value))}
                className="bookshelf-widget__slider"
                style={{ '--progress-color': activeColor }}
              />
            </div>
          )}

          {/* Notes */}
          <div className="bookshelf-widget__notes">
            <label htmlFor="reading-notes">Notes</label>
            <textarea
              id="reading-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Your private notes…"
              rows={3}
              maxLength={2000}
            />
          </div>

          {/* Remove */}
          <button
            type="button"
            className="bookshelf-widget__remove-btn"
            onClick={handleRemove}
            disabled={busy}
          >
            🗑️ Remove from list
          </button>
        </div>
      )}
    </div>
  );
}
