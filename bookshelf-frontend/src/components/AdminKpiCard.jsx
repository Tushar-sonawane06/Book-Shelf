/**
 * AdminKpiCard — a single key-performance-indicator card in the admin
 * dashboard.  Shows an icon, label, value, and optional trend indicator.
 */
export default function AdminKpiCard({ icon, label, value, trend, loading = false }) {
  const trendUp = trend > 0;
  const trendFlat = trend === 0 || trend === undefined || trend === null;

  return (
    <div className={`admin-kpi ${loading ? 'admin-kpi--loading' : ''}`}>
      <div className="admin-kpi__icon">{icon}</div>
      <div className="admin-kpi__content">
        <span className="admin-kpi__label">{label}</span>
        {loading ? (
          <div className="admin-kpi__skeleton" />
        ) : (
          <span className="admin-kpi__value">{value}</span>
        )}
        {!loading && !trendFlat && (
          <span
            className={`admin-kpi__trend ${
              trendUp ? 'admin-kpi__trend--up' : 'admin-kpi__trend--down'
            }`}
          >
            {trendUp ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}
