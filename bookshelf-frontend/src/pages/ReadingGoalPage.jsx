import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getGoal,
  setGoal,
  recordCompletion,
  undoCompletion,
  getHistory,
} from '../services/readingGoalService.js';
import './ReadingGoalPage.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function ReadingGoalPage() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [goal, setGoalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [goalInput, setGoalInput] = useState('12');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [history, setHistory] = useState([]);

  const flash = useCallback((msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  }, []);

  const loadGoal = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getGoal();
      setGoalData(data);
      setGoalInput(String(data.yearlyGoal));
    } catch (err) {
      flash(err?.message || 'Failed to load goal');
    } finally {
      setLoading(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getHistory(3);
      setHistory(data || []);
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => {
    loadGoal();
    loadHistory();
  }, [loadGoal, loadHistory]);

  async function handleSetGoal() {
    const num = Number(goalInput);
    if (!num || num < 1 || num > 365) {
      flash('Goal must be between 1 and 365');
      return;
    }
    try {
      const data = await setGoal(num);
      setGoalData(data.goal);
      setShowGoalForm(false);
      flash(`Goal set to ${num} books!`);
      loadHistory();
    } catch (err) {
      flash(err?.message || 'Failed to set goal');
    }
  }

  async function handleComplete(month) {
    try {
      const data = await recordCompletion(month);
      setGoalData(data.goal);
      flash(`Recorded completion for ${MONTH_NAMES[month - 1]}!`);
    } catch (err) {
      flash(err?.message || 'Failed to record');
    }
  }

  async function handleUndo(month) {
    try {
      const data = await undoCompletion(month);
      setGoalData(data.goal);
      flash(`Undid completion for ${MONTH_NAMES[month - 1]}`);
    } catch (err) {
      flash(err?.message || 'Failed to undo');
    }
  }

  if (!user) {
    return (
      <main className="rg-page">
        <div className="rg-page__empty">
          <h2>📖 Reading Goal</h2>
          <p>Log in to set and track your reading goals.</p>
          <Link to="/login" className="rg-page__login-btn">Log in</Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="rg-page rg-page--loading">
        <div className="rg-page__spinner" />
        <span>Loading…</span>
      </main>
    );
  }

  const stats = goal?.stats || { yearlyGoal: 12, totalRead: 0, percentage: 0, remaining: 12, paceNeeded: 1, onTrack: true };
  const months = goal?.months || [];
  const maxBooks = Math.max(1, ...months.map((m) => m.booksRead));

  return (
    <main className="rg-page">
      <header className="rg-page__header">
        <h1 className="rg-page__title">📖 Reading Goal {currentYear}</h1>
        <Link to="/" className="rg-page__browse-link">Browse books →</Link>
      </header>

      {message && <div className="rg-page__toast" role="status">{message}</div>}

      {/* Stats banner */}
      <div className="rg-page__stats">
        <div className="rg-page__stat">
          <span className="rg-page__stat-value">{stats.totalRead}</span>
          <span className="rg-page__stat-label">Books read</span>
        </div>
        <div className="rg-page__stat">
          <span className="rg-page__stat-value">{stats.yearlyGoal}</span>
          <span className="rg-page__stat-label">Goal</span>
        </div>
        <div className="rg-page__stat">
          <span className="rg-page__stat-value">{stats.percentage}%</span>
          <span className="rg-page__stat-label">Progress</span>
        </div>
        <div className="rg-page__stat">
          <span className="rg-page__stat-value">{stats.remaining}</span>
          <span className="rg-page__stat-label">Remaining</span>
        </div>
        <div className="rg-page__stat">
          <span className={`rg-page__stat-value ${stats.onTrack ? 'rg-page__stat-value--green' : 'rg-page__stat-value--amber'}`}>
            {stats.onTrack ? '✅' : '⚠️'}
          </span>
          <span className="rg-page__stat-label">{stats.onTrack ? 'On track' : 'Behind'}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rg-page__progress-section">
        <div className="rg-page__progress-header">
          <span>Annual progress</span>
          <button
            type="button"
            className="rg-page__edit-goal-btn"
            onClick={() => setShowGoalForm(!showGoalForm)}
          >
            {showGoalForm ? 'Cancel' : '✏️ Edit goal'}
          </button>
        </div>
        <div className="rg-page__progress-track">
          <div
            className="rg-page__progress-fill"
            style={{
              width: `${stats.percentage}%`,
              background: stats.percentage >= 100 ? '#10b981' : '#6366f1',
            }}
          />
        </div>
        {showGoalForm && (
          <div className="rg-page__goal-form">
            <label htmlFor="goal-input">Set yearly goal:</label>
            <input
              id="goal-input"
              type="number"
              min="1"
              max="365"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="rg-page__goal-input"
            />
            <button type="button" className="rg-page__save-btn" onClick={handleSetGoal}>
              Save
            </button>
          </div>
        )}
      </div>

      {/* Monthly breakdown */}
      <section className="rg-page__months">
        <h2 className="rg-page__section-title">Monthly breakdown</h2>
        <div className="rg-page__month-grid">
          {MONTH_NAMES.map((name, i) => {
            const monthNum = i + 1;
            const monthData = months.find((m) => m.month === monthNum);
            const count = monthData?.booksRead || 0;
            const isCurrent = monthNum === currentMonth;
            const isPast = monthNum < currentMonth;
            const barPct = maxBooks > 0 ? (count / maxBooks) * 100 : 0;

            return (
              <div
                key={monthNum}
                className={`rg-page__month-card ${isCurrent ? 'rg-page__month-card--current' : ''} ${isPast && !monthData ? 'rg-page__month-card--missed' : ''}`}
              >
                <div className="rg-page__month-header">
                  <span className="rg-page__month-name">{MONTH_SHORT[i]}</span>
                  <span className="rg-page__month-count">{count}</span>
                </div>
                <div className="rg-page__month-bar-track">
                  <div
                    className="rg-page__month-bar-fill"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                {isCurrent && (
                  <div className="rg-page__month-actions">
                    <button
                      type="button"
                      className="rg-page__month-btn rg-page__month-btn--add"
                      onClick={() => handleComplete(monthNum)}
                    >
                      +1
                    </button>
                    {count > 0 && (
                      <button
                        type="button"
                        className="rg-page__month-btn rg-page__month-btn--undo"
                        onClick={() => handleUndo(monthNum)}
                      >
                        −1
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* History */}
      {history.length > 0 && (
        <section className="rg-page__history">
          <h2 className="rg-page__section-title">Past years</h2>
          <div className="rg-page__history-list">
            {history.map((h) => (
              <div key={h.year} className="rg-page__history-card">
                <span className="rg-page__history-year">{h.year}</span>
                <div className="rg-page__history-bar-track">
                  <div
                    className="rg-page__history-bar-fill"
                    style={{ width: `${h.percentage}%` }}
                  />
                </div>
                <span className="rg-page__history-text">
                  {h.totalRead}/{h.yearlyGoal} ({h.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
