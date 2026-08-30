import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getClub,
  leaveClub,
  updateProgress,
  sendMessage,
  deleteMessage,
  setCurrentBook,
  getClubStats,
  deleteClub,
  transferOwnership,
  removeMember,
} from '../services/bookClubService.js';
import './BookClubDetailPage.css';

const PROGRESS_PRESETS = [0, 25, 50, 75, 100];

export default function BookClubDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  // ── State ──────────────────────────────────────────────────────────────
  const [club, setClub] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('discussion');

  // Message form
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Progress
  const [myProgress, setMyProgress] = useState(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    description: '',
    genre: '',
  });

  // Set book form
  const [showSetBook, setShowSetBook] = useState(false);
  const [bookForm, setBookForm] = useState({ bookId: '', bookTitle: '' });

  // ── Flash ──────────────────────────────────────────────────────────────
  const flash = useCallback((msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────
  const loadClub = useCallback(async () => {
    try {
      const data = await getClub(id);
      setClub(data);

      // Find my progress
      const me = data.members?.find((m) => m.userId === user?._id);
      if (me) setMyProgress(me.readingProgress);

      // Pre-fill settings
      setSettingsForm({
        name: data.name || '',
        description: data.description || '',
        genre: data.genre || '',
      });
    } catch (err) {
      flash(err?.message || 'Failed to load club');
    } finally {
      setLoading(false);
    }
  }, [id, user, flash]);

  const loadStats = useCallback(async () => {
    try {
      const data = await getClubStats(id);
      setStats(data);
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    loadClub();
    loadStats();
  }, [loadClub, loadStats]);

  // ── Auto-scroll to latest message ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [club?.messages?.length]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const isMember = () => club?.members?.some((m) => m.userId === user?._id);
  const myMemberRecord = () => club?.members?.find((m) => m.userId === user?._id);
  const isOwner = () => myMemberRecord()?.role === 'owner';
  const isModerator = () => {
    const role = myMemberRecord()?.role;
    return role === 'owner' || role === 'moderator';
  };

  // ── Send message ──────────────────────────────────────────────────────
  async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage(id, { content: newMessage.trim() });
      setClub((prev) => ({
        ...prev,
        messages: [...(prev.messages || []), msg],
      }));
      setNewMessage('');
    } catch (err) {
      flash(err?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  // ── Delete message ────────────────────────────────────────────────────
  async function handleDeleteMessage(messageId) {
    try {
      await deleteMessage(id, messageId);
      setClub((prev) => ({
        ...prev,
        messages: (prev.messages || []).filter((m) => m._id !== messageId),
      }));
      flash('Message deleted');
    } catch (err) {
      flash(err?.message || 'Failed to delete message');
    }
  }

  // ── Update progress ───────────────────────────────────────────────────
  async function handleSetProgress(progress) {
    try {
      await updateProgress(id, progress);
      setMyProgress(progress);
      // Update local club state
      setClub((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.userId === user._id ? { ...m, readingProgress: progress } : m
        ),
      }));
      flash(`Progress set to ${progress}%`);
      loadStats();
    } catch (err) {
      flash(err?.message || 'Failed to update progress');
    }
  }

  // ── Leave club ────────────────────────────────────────────────────────
  async function handleLeave() {
    if (!window.confirm('Are you sure you want to leave this club?')) return;
    try {
      await leaveClub(id);
      flash('Left the club');
      navigate('/book-clubs');
    } catch (err) {
      flash(err?.message || 'Failed to leave club');
    }
  }

  // ── Delete club ───────────────────────────────────────────────────────
  async function handleDeleteClub() {
    if (!window.confirm('Delete this club permanently? This cannot be undone.')) return;
    try {
      await deleteClub(id);
      flash('Club deleted');
      navigate('/book-clubs');
    } catch (err) {
      flash(err?.message || 'Failed to delete club');
    }
  }

  // ── Update settings ───────────────────────────────────────────────────
  async function handleUpdateSettings(e) {
    e.preventDefault();
    try {
      const updated = await (await import('../services/bookClubService.js')).updateClub(id, settingsForm);
      setClub((prev) => ({ ...prev, ...updated }));
      setShowSettings(false);
      flash('Club settings updated');
    } catch (err) {
      flash(err?.message || 'Failed to update settings');
    }
  }

  // ── Set current book ──────────────────────────────────────────────────
  async function handleSetBook(e) {
    e.preventDefault();
    if (!bookForm.bookId.trim() || !bookForm.bookTitle.trim()) {
      flash('Both book ID and title are required');
      return;
    }
    try {
      const updated = await setCurrentBook(id, bookForm.bookId.trim(), bookForm.bookTitle.trim());
      setClub(updated);
      setShowSetBook(false);
      setBookForm({ bookId: '', bookTitle: '' });
      flash('Club book updated!');
      loadStats();
    } catch (err) {
      flash(err?.message || 'Failed to set book');
    }
  }

  // ── Remove member ─────────────────────────────────────────────────────
  async function handleRemoveMember(userId) {
    if (!window.confirm('Remove this member from the club?')) return;
    try {
      await removeMember(id, userId);
      setClub((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.userId !== userId),
      }));
      flash('Member removed');
      loadStats();
    } catch (err) {
      flash(err?.message || 'Failed to remove member');
    }
  }

  // ── Transfer ownership ────────────────────────────────────────────────
  async function handleTransferOwnership(userId) {
    if (!window.confirm('Transfer club ownership? You will become a regular member.')) return;
    try {
      const updated = await transferOwnership(id, userId);
      setClub(updated);
      flash('Ownership transferred');
    } catch (err) {
      flash(err?.message || 'Failed to transfer ownership');
    }
  }

  // ── Loading / not found ───────────────────────────────────────────────
  if (loading) {
    return (
      <main className="bcd-page">
        <div className="bcd-page__loading">
          <div className="bcd-page__spinner" />
          <span>Loading club…</span>
        </div>
      </main>
    );
  }

  if (!club) {
    return (
      <main className="bcd-page">
        <div className="bcd-page__empty">
          <h2>Club not found</h2>
          <Link to="/book-clubs" className="bcd-page__back-link">← Back to clubs</Link>
        </div>
      </main>
    );
  }

  const avgProgress = stats?.avgProgress ?? 0;
  const membersReading = stats?.membersReading ?? 0;
  const membersFinished = stats?.membersFinished ?? 0;

  return (
    <main className="bcd-page">
      {message && (
        <div className="bcd-page__toast" role="status">{message}</div>
      )}

      {/* ── Club Header ────────────────────────────────────────────────── */}
      <header className="bcd-page__header">
        <div className="bcd-page__header-top">
          <Link to="/book-clubs" className="bcd-page__back-link">← All Clubs</Link>
          {isOwner() && (
            <div className="bcd-page__owner-actions">
              <button
                type="button"
                className="bcd-page__settings-btn"
                onClick={() => setShowSettings(!showSettings)}
              >
                ⚙️ Settings
              </button>
              <button
                type="button"
                className="bcd-page__danger-btn"
                onClick={handleDeleteClub}
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
        <h1 className="bcd-page__title">{club.name}</h1>
        <div className="bcd-page__header-meta">
          {club.genre && <span className="bcd-page__genre-tag">{club.genre}</span>}
          <span>👥 {club.memberCount} member{club.memberCount !== 1 ? 's' : ''}</span>
          <span>Created by {club.ownerName}</span>
        </div>
        {club.description && (
          <p className="bcd-page__description">{club.description}</p>
        )}
      </header>

      {/* ── Settings Panel ──────────────────────────────────────────────── */}
      {showSettings && (
        <section className="bcd-page__settings-panel">
          <h2 className="bcd-page__section-title">Club Settings</h2>
          <form className="bcd-page__settings-form" onSubmit={handleUpdateSettings}>
            <div className="bcd-page__field">
              <label htmlFor="settings-name">Club name</label>
              <input
                id="settings-name"
                type="text"
                value={settingsForm.name}
                onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="bcd-page__field">
              <label htmlFor="settings-genre">Genre</label>
              <input
                id="settings-genre"
                type="text"
                value={settingsForm.genre}
                onChange={(e) => setSettingsForm({ ...settingsForm, genre: e.target.value })}
                maxLength={60}
              />
            </div>
            <div className="bcd-page__field bcd-page__field--full">
              <label htmlFor="settings-desc">Description</label>
              <textarea
                id="settings-desc"
                rows={3}
                value={settingsForm.description}
                onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                maxLength={2000}
              />
            </div>
            <button type="submit" className="bcd-page__save-btn">Save Changes</button>
          </form>
        </section>
      )}

      {/* ── Set Book Panel ──────────────────────────────────────────────── */}
      {showSetBook && isModerator() && (
        <section className="bcd-page__settings-panel">
          <h2 className="bcd-page__section-title">Set Club Book</h2>
          <form className="bcd-page__settings-form" onSubmit={handleSetBook}>
            <div className="bcd-page__field">
              <label htmlFor="book-id">Book ID *</label>
              <input
                id="book-id"
                type="text"
                value={bookForm.bookId}
                onChange={(e) => setBookForm({ ...bookForm, bookId: e.target.value })}
                placeholder="Enter book ID from the catalog"
                required
              />
            </div>
            <div className="bcd-page__field">
              <label htmlFor="book-title">Book title *</label>
              <input
                id="book-title"
                type="text"
                value={bookForm.bookTitle}
                onChange={(e) => setBookForm({ ...bookForm, bookTitle: e.target.value })}
                placeholder="e.g. Dune"
                required
              />
            </div>
            <button type="submit" className="bcd-page__save-btn">Set Book</button>
          </form>
        </section>
      )}

      {/* ── Current Book + Stats Banner ─────────────────────────────────── */}
      <div className="bcd-page__stats-banner">
        <div className="bcd-page__current-book">
          <h3 className="bcd-page__stat-label">Currently Reading</h3>
          {club.currentBookTitle ? (
            <p className="bcd-page__book-title">📖 {club.currentBookTitle}</p>
          ) : (
            <p className="bcd-page__no-book">No book set yet</p>
          )}
          {isModerator() && (
            <button
              type="button"
              className="bcd-page__small-btn"
              onClick={() => setShowSetBook(!showSetBook)}
            >
              {showSetBook ? 'Cancel' : '✏️ Change book'}
            </button>
          )}
        </div>
        <div className="bcd-page__stat">
          <span className="bcd-page__stat-value">{avgProgress}%</span>
          <span className="bcd-page__stat-label">Avg progress</span>
        </div>
        <div className="bcd-page__stat">
          <span className="bcd-page__stat-value">{membersReading}</span>
          <span className="bcd-page__stat-label">Reading</span>
        </div>
        <div className="bcd-page__stat">
          <span className="bcd-page__stat-value">{membersFinished}</span>
          <span className="bcd-page__stat-label">Finished</span>
        </div>
      </div>

      {/* ── My Progress ─────────────────────────────────────────────────── */}
      {isMember() && club.currentBookId && (
        <div className="bcd-page__my-progress">
          <span className="bcd-page__progress-label">Your progress:</span>
          <div className="bcd-page__progress-bar-track">
            <div
              className="bcd-page__progress-bar-fill"
              style={{
                width: `${myProgress ?? 0}%`,
                background: (myProgress ?? 0) >= 100 ? '#10b981' : '#6366f1',
              }}
            />
          </div>
          <span className="bcd-page__progress-value">{myProgress ?? 0}%</span>
          <div className="bcd-page__progress-presets">
            {PROGRESS_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`bcd-page__preset-btn ${myProgress === p ? 'bcd-page__preset-btn--active' : ''}`}
                onClick={() => handleSetProgress(p)}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="bcd-page__tabs">
        <button
          type="button"
          className={`bcd-page__tab ${activeTab === 'discussion' ? 'bcd-page__tab--active' : ''}`}
          onClick={() => setActiveTab('discussion')}
        >
          💬 Discussion ({club.messages?.length || 0})
        </button>
        <button
          type="button"
          className={`bcd-page__tab ${activeTab === 'members' ? 'bcd-page__tab--active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          👥 Members ({club.memberCount})
        </button>
        <button
          type="button"
          className={`bcd-page__tab ${activeTab === 'progress' ? 'bcd-page__tab--active' : ''}`}
          onClick={() => setActiveTab('progress')}
        >
          📊 Progress
        </button>
        {!isMember() && user && (
          <button
            type="button"
            className="bcd-page__join-tab-btn"
            onClick={handleLeave}
          >
            Join Club
          </button>
        )}
      </div>

      {/* ── Discussion Tab ───────────────────────────────────────────────── */}
      {activeTab === 'discussion' && (
        <section className="bcd-page__discussion">
          <div className="bcd-page__messages">
            {(club.messages || []).length === 0 ? (
              <div className="bcd-page__empty-messages">
                No messages yet. Start the conversation!
              </div>
            ) : (
              (club.messages || []).map((msg) => (
                <div
                  key={msg._id || msg.createdAt}
                  className={`bcd-page__message ${msg.authorId === user?._id ? 'bcd-page__message--mine' : ''}`}
                >
                  <div className="bcd-page__message-header">
                    <span className="bcd-page__message-author">{msg.authorName}</span>
                    <span className="bcd-page__message-time">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                    {(msg.authorId === user?._id || isModerator()) && (
                      <button
                        type="button"
                        className="bcd-page__msg-delete"
                        onClick={() => handleDeleteMessage(msg._id)}
                        title="Delete message"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="bcd-page__message-content">{msg.content}</p>
                  {msg.bookId && (
                    <span className="bcd-page__message-book-tag">📚 {msg.bookId}</span>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {isMember() && (
            <form className="bcd-page__message-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="bcd-page__message-input"
                placeholder="Type a message…"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                maxLength={2000}
              />
              <button
                type="submit"
                className="bcd-page__send-btn"
                disabled={sending || !newMessage.trim()}
              >
                {sending ? '…' : 'Send'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* ── Members Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <section className="bcd-page__members">
          {(club.members || []).map((m) => (
            <div key={m.userId} className="bcd-page__member-row">
              <div className="bcd-page__member-info">
                <span className="bcd-page__member-name">
                  {m.userId === user?._id ? `${m.userId === user._id ? 'You' : ''}` : ''}
                </span>
                <span className="bcd-page__member-id">{m.userId}</span>
                <span className={`bcd-page__member-role bcd-page__member-role--${m.role}`}>
                  {m.role}
                </span>
                <span className="bcd-page__member-joined">
                  Joined {new Date(m.joinedAt).toLocaleDateString()}
                </span>
              </div>
              {m.readingProgress !== null && m.readingProgress !== undefined && (
                <div className="bcd-page__member-progress">
                  <div className="bcd-page__mini-progress-track">
                    <div
                      className="bcd-page__mini-progress-fill"
                      style={{ width: `${m.readingProgress}%` }}
                    />
                  </div>
                  <span>{m.readingProgress}%</span>
                </div>
              )}
              {isModerator() && m.userId !== user?._id && m.role !== 'owner' && (
                <div className="bcd-page__member-actions">
                  <button
                    type="button"
                    className="bcd-page__small-btn"
                    onClick={() => handleRemoveMember(m.userId)}
                  >
                    Remove
                  </button>
                  {isOwner() && (
                    <button
                      type="button"
                      className="bcd-page__small-btn"
                      onClick={() => handleTransferOwnership(m.userId)}
                    >
                      Transfer Ownership
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Progress Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'progress' && (
        <section className="bcd-page__progress-tab">
          <div className="bcd-page__progress-summary">
            <div className="bcd-page__progress-summary-item">
              <span className="bcd-page__progress-summary-value">{stats?.totalMembers || 0}</span>
              <span className="bcd-page__progress-summary-label">Total members</span>
            </div>
            <div className="bcd-page__progress-summary-item">
              <span className="bcd-page__progress-summary-value">{membersReading}</span>
              <span className="bcd-page__progress-summary-label">Currently reading</span>
            </div>
            <div className="bcd-page__progress-summary-item">
              <span className="bcd-page__progress-summary-value">{membersFinished}</span>
              <span className="bcd-page__progress-summary-label">Finished</span>
            </div>
            <div className="bcd-page__progress-summary-item">
              <span className="bcd-page__progress-summary-value">{avgProgress}%</span>
              <span className="bcd-page__progress-summary-label">Average progress</span>
            </div>
          </div>

          <div className="bcd-page__progress-list">
            {(stats?.members || []).map((m) => (
              <div key={m.userId} className="bcd-page__progress-row">
                <span className="bcd-page__progress-member-name">
                  {m.userId === user?._id ? 'You' : m.userId}
                  {m.role !== 'member' && <span className="bcd-page__role-badge">{m.role}</span>}
                </span>
                <div className="bcd-page__progress-row-bar-track">
                  <div
                    className="bcd-page__progress-row-bar-fill"
                    style={{
                      width: `${m.readingProgress ?? 0}%`,
                      background: (m.readingProgress ?? 0) >= 100 ? '#10b981' : '#6366f1',
                    }}
                  />
                </div>
                <span className="bcd-page__progress-row-value">
                  {m.readingProgress !== null ? `${m.readingProgress}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Leave Club ───────────────────────────────────────────────────── */}
      {isMember() && !isOwner() && (
        <div className="bcd-page__leave-section">
          <button
            type="button"
            className="bcd-page__leave-btn"
            onClick={handleLeave}
          >
            Leave Club
          </button>
        </div>
      )}
    </main>
  );
}
