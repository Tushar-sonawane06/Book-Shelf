import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useReadingList } from '../hooks/useReadingList.js';
import ReadingListShelf from '../components/ReadingListShelf.jsx';
import './ReadingListPage.css';

/**
 * Full-page reading list / bookshelf tracker.
 *
 * Shows three shelf tabs (Want to Read, Currently Reading, Finished),
 * a stats summary banner, and the books on each shelf with move/remove
 * controls.
 */
export default function ReadingListPage() {
  const { entries, stats, loading, error, update, remove, refresh } = useReadingList();
  const [activeTab, setActiveTab] = useState('all');

  // Group entries by shelf
  const grouped = useMemo(() => {
    const groups = {
      'want-to-read': [],
      'currently-reading': [],
      'finished': [],
    };
    for (const entry of entries) {
      if (groups[entry.shelf]) {
        groups[entry.shelf].push(entry);
      }
    }
    return groups;
  }, [entries]);

  const tabs = [
    { key: 'all', label: 'All', count: entries.length },
    { key: 'want-to-read', label: '📚 Want to Read', count: grouped['want-to-read'].length },
    { key: 'currently-reading', label: '📖 Reading', count: grouped['currently-reading'].length },
    { key: 'finished', label: '✅ Finished', count: grouped['finished'].length },
  ];

  async function handleMove(entryId, newShelf) {
    try {
      await update(entryId, { shelf: newShelf });
    } catch {
      // error handled by hook
    }
  }

  async function handleRemove(entryId) {
    if (!window.confirm('Remove this book from your reading list?')) return;
    try {
      await remove(entryId);
    } catch {
      // error handled by hook
    }
  }

  async function handleProgressChange(entryId, progress) {
    try {
      await update(entryId, { progress });
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <main className="rl-page rl-page--loading">
        <div className="rl-page__spinner" />
        <span>Loading your reading list…</span>
      </main>
    );
  }

  if (error) {
    return (
      <main className="rl-page rl-page--error">
        <h2>Could not load reading list</h2>
        <p>{error}</p>
        <button type="button" onClick={refresh} className="rl-page__retry-btn">
          Retry
        </button>
        <Link to="/" className="rl-page__back-link">← Back to catalogue</Link>
      </main>
    );
  }

  const showAll = activeTab === 'all';

  return (
    <main className="rl-page">
      <header className="rl-page__header">
        <h1 className="rl-page__title">📖 My Reading List</h1>
        <Link to="/" className="rl-page__catalog-link">Browse catalogue →</Link>
      </header>

      {/* Stats banner */}
      {stats && entries.length > 0 && (
        <div className="rl-page__stats">
          <div className="rl-page__stat">
            <span className="rl-page__stat-value">{stats.total}</span>
            <span className="rl-page__stat-label">Total books</span>
          </div>
          <div className="rl-page__stat">
            <span className="rl-page__stat-value">{stats.finished}</span>
            <span className="rl-page__stat-label">Finished</span>
          </div>
          <div className="rl-page__stat">
            <span className="rl-page__stat-value">{stats['currently-reading']}</span>
            <span className="rl-page__stat-label">In progress</span>
          </div>
          {stats.averageRating != null && (
            <div className="rl-page__stat">
              <span className="rl-page__stat-value">★ {stats.averageRating}</span>
              <span className="rl-page__stat-label">Avg rating</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="rl-page__tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`rl-page__tab ${activeTab === tab.key ? 'rl-page__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="rl-page__tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Shelves */}
      <div className="rl-page__content">
        {entries.length === 0 ? (
          <div className="rl-page__empty">
            <span className="rl-page__empty-icon">📚</span>
            <h2>Your reading list is empty</h2>
            <p>Browse the catalogue and add books to track your reading journey.</p>
            <Link to="/" className="rl-page__browse-btn">
              Browse books
            </Link>
          </div>
        ) : (
          <>
            {(showAll || activeTab === 'want-to-read') && (
              <ReadingListShelf
                shelf="want-to-read"
                entries={grouped['want-to-read']}
                onMove={handleMove}
                onRemove={handleRemove}
                onProgressChange={handleProgressChange}
              />
            )}
            {(showAll || activeTab === 'currently-reading') && (
              <ReadingListShelf
                shelf="currently-reading"
                entries={grouped['currently-reading']}
                onMove={handleMove}
                onRemove={handleRemove}
                onProgressChange={handleProgressChange}
              />
            )}
            {(showAll || activeTab === 'finished') && (
              <ReadingListShelf
                shelf="finished"
                entries={grouped['finished']}
                onMove={handleMove}
                onRemove={handleRemove}
                onProgressChange={handleProgressChange}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
