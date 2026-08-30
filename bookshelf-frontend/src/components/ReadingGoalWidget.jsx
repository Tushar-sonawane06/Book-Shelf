import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getGoal } from '../services/readingGoalService.js';
import './ReadingGoalWidget.css';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Compact reading goal widget showing a circular progress ring.
 *
 * Used on the profile page or sidebar. Displays the percentage of the
 * yearly goal achieved, books read, and the target.
 */
export default function ReadingGoalWidget({ compact = false }) {
  const { user } = useAuth();
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    getGoal()
      .then((data) => { if (!cancelled) setGoal(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  if (loading || !goal) {
    return (
      <div className={`rgw ${compact ? 'rgw--compact' : ''}`}>
        {!loading && !user && <p className="rgw__login-hint">Log in to track your reading goal.</p>}
      </div>
    );
  }

  const { stats, months } = goal;
  const pct = stats.percentage;
  const currentMonth = new Date().getMonth() + 1;
  const monthBooks = months.find((m) => m.month === currentMonth)?.booksRead ?? 0;

  // SVG circle params
  const radius = compact ? 36 : 54;
  const stroke = compact ? 5 : 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={`rgw ${compact ? 'rgw--compact' : ''}`}>
      <div className="rgw__ring-wrapper">
        <svg
          className="rgw__ring"
          width={radius * 2 + stroke}
          height={radius * 2 + stroke}
          viewBox={`0 0 ${radius * 2 + stroke} ${radius * 2 + stroke}`}
        >
          <circle
            className="rgw__ring-bg"
            cx={radius + stroke / 2}
            cy={radius + stroke / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={stroke}
          />
          <circle
            className="rgw__ring-fill"
            cx={radius + stroke / 2}
            cy={radius + stroke / 2}
            r={radius}
            fill="none"
            stroke={pct >= 100 ? '#10b981' : '#6366f1'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${radius + stroke / 2} ${radius + stroke / 2})`}
          />
        </svg>
        <span className="rgw__ring-pct">{pct}%</span>
      </div>

      <div className="rgw__info">
        <span className="rgw__books-read">
          {stats.totalRead} of {stats.yearlyGoal} books
        </span>
        {!compact && (
          <>
            <span className="rgw__month-count">
              {monthBooks} this month ({MONTH_NAMES[currentMonth - 1]})
            </span>
            {stats.onTrack ? (
              <span className="rgw__status rgw__status--on-track">✅ On track</span>
            ) : (
              <span className="rgw__status rgw__status--behind">
                📚 {stats.paceNeeded}/mo needed to finish
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
