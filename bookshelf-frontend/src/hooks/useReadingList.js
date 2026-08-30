import { useState, useEffect, useCallback } from 'react';
import {
  getMyReadingList,
  checkReadingList,
  addToList,
  updateEntry,
  removeEntry,
  removeByBookId,
  getReadingStats,
} from '../services/readingListService.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Hook for the current user's reading list.
 *
 * Returns the full list, per-shelf counts, loading state, and action
 * functions. Optimistic updates keep the UI snappy; the server response
 * reconciles on success and rolls back on failure.
 */
export function useReadingList() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState('');

  const fetchList = useCallback(async (shelf) => {
    if (!user) {
      setEntries([]);
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await getMyReadingList({ shelf });
      setEntries(data.entries || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err?.message || 'Failed to load reading list');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  /**
   * Add a book or move it to a different shelf.
   * Returns the server response so callers can inspect the result.
   */
  const addBook = useCallback(
    async (bookId, shelf = 'want-to-read', { notes, rating } = {}) => {
      const data = await addToList({ bookId, shelf, notes, rating });
      // Refresh to get consistent state
      await fetchList();
      return data;
    },
    [fetchList]
  );

  const update = useCallback(
    async (entryId, updates) => {
      const data = await updateEntry(entryId, updates);
      await fetchList();
      return data;
    },
    [fetchList]
  );

  const remove = useCallback(
    async (entryId) => {
      const data = await removeEntry(entryId);
      await fetchList();
      return data;
    },
    [fetchList]
  );

  const removeBook = useCallback(
    async (bookId) => {
      const data = await removeByBookId(bookId);
      await fetchList();
      return data;
    },
    [fetchList]
  );

  /**
   * Convenience: check if a specific book is on the list.
   */
  const checkBook = useCallback(
    async (bookId) => {
      if (!user) return { onList: false, entry: null };
      return checkReadingList(bookId);
    },
    [user]
  );

  return {
    entries,
    stats,
    loading,
    error,
    addBook,
    update,
    remove,
    removeBook,
    checkBook,
    refresh: fetchList,
  };
}

export default useReadingList;
