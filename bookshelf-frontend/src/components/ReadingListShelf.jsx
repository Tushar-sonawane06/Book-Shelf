import { useState } from 'react';
import './ReadingListShelf.css';

const SHELF_META = {
  'want-to-read': { icon: '📚', label: 'Want to Read', color: '#6366f1' },
  'currently-reading': { icon: '📖', label: 'Currently Reading', color: '#f59e0b' },
  'finished': { icon: '✅', label: 'Finished', color: '#10b981' },
};

const MOVE_OPTIONS = [
  { value: 'want-to-read', label: '📚 Want to Read' },
  { value: 'currently-reading', label: '📖 Currently Reading' },
  { value: 'finished', label: '✅ Finished' },
];

/**
 * A single shelf within the reading list page.
 *
 * Displays book cards with their metadata, progress bar (for currently
 * reading), notes, rating, and action buttons to move or remove.
 */
export default function ReadingListShelf({ shelf, entries, onMove, onRemove, onProgressChange }) {
  const meta = SHELF_META[shelf] || SHELF_META['want-to-read'];
  const [expandedId, setExpandedId] = useState(null);

  if (!entries || entries.length === 0) return null;

  return (
    <section className="reading-shelf" aria-label={meta.label}>
      <h2 className="reading-shelf__title">
        <span className="reading-shelf__icon" style={{ color: meta.color }}>
          {meta.icon}
        </span>
        {meta.label}
        <span className="reading-shelf__count">{entries.length}</span>
      </h2>

      <div className="reading-shelf__grid">
        {entries.map((entry) => {
          const isExpanded = expandedId === entry.id;
          return (
            <div key={entry.id} className="reading-shelf__card">
              <div className="reading-shelf__card-header">
                <span className="reading-shelf__book-id" title={entry.bookId}>
                  {entry.bookId}
                </span>
                <span className="reading-shelf__date">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Progress bar for currently reading */}
              {shelf === 'currently-reading' && entry.progress != null && (
                <div className="reading-shelf__progress">
                  <div className="reading-shelf__progress-track">
                    <div
                      className="reading-shelf__progress-fill"
                      style={{
                        width: `${entry.progress}%`,
                        background: meta.color,
                      }}
                    />
                  </div>
                  <span className="reading-shelf__progress-pct">{entry.progress}%</span>
                </div>
              )}

              {/* Rating */}
              {entry.rating && (
                <div className="reading-shelf__rating">
                  {'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}
                </div>
              )}

              {/* Notes preview */}
              {entry.notes && (
                <p className="reading-shelf__notes-preview">
                  {isExpanded ? entry.notes : entry.notes.slice(0, 80)}
                  {!isExpanded && entry.notes.length > 80 ? '…' : ''}
                </p>
              )}

              {/* Dates */}
              {(entry.startedAt || entry.finishedAt) && isExpanded && (
                <div className="reading-shelf__dates">
                  {entry.startedAt && (
                    <span>Started: {new Date(entry.startedAt).toLocaleDateString()}</span>
                  )}
                  {entry.finishedAt && (
                    <span>Finished: {new Date(entry.finishedAt).toLocaleDateString()}</span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="reading-shelf__actions">
                {/* Move to shelf */}
                <select
                  className="reading-shelf__move-select"
                  value={shelf}
                  onChange={(e) => onMove(entry.id, e.target.value)}
                  aria-label="Move to shelf"
                >
                  {MOVE_OPTIONS.filter((o) => o.value !== shelf).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="reading-shelf__expand-btn"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  {isExpanded ? '▲' : '▼'}
                </button>

                <button
                  type="button"
                  className="reading-shelf__remove-btn"
                  onClick={() => onRemove(entry.id)}
                  aria-label="Remove from list"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
