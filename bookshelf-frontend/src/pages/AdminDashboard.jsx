import { useState, useEffect } from 'react';

import AdminKpiCard from '../components/AdminKpiCard.jsx';
import AdminSalesChart from '../components/AdminSalesChart.jsx';
import AdminTopBooks from '../components/AdminTopBooks.jsx';
import AdminRecentOrders from '../components/AdminRecentOrders.jsx';
import { getDashboardStats } from '../services/adminService.js';
import { formatMoney } from '../utils/currency.js';
import { usePageMetadata } from '../hooks/usePageMetadata.js';

import '../components/AdminKpiCard.css';
import '../components/AdminSalesChart.css';
/*
 * AdminTopBooks.css also carries AdminRecentOrders' styles — the two share the
 * whole `.admin-table*` set, badges included — so there is no
 * AdminRecentOrders.css to import. There was an import for one anyway, which
 * is an unresolved module: Vite fails the build on it. It went unnoticed
 * because nothing routes to AdminDashboard, so the page has never been in the
 * bundle graph for the build to walk.
 */
import '../components/AdminTopBooks.css';
import './AdminDashboard.css';

/**
 * AdminDashboard — the full admin analytics page.
 *
 * Fetches KPIs from the backend on mount and passes them to KPI cards.
 * The chart, top-books, and recent-orders sections each fetch their own
 * data independently so a slow aggregation does not block the KPIs.
 */
export default function AdminDashboard() {
  // No route meant no title either; the tab kept the previous page's. See
  // #337 for the rest of them.
  usePageMetadata({
    title: 'Admin dashboard',
    description: 'Sales, top books and recent orders across the shop.',
  });

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    getDashboardStats({ signal: controller.signal })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.code !== 'ERR_CANCELED') {
          setError(err.message || 'Failed to load dashboard stats');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  /*
   * Money on this page goes through utils/currency.js, like money everywhere
   * else does since #335.
   *
   * There was a local formatter here reading `₹${(value || 0)
   * .toLocaleString()}`, and it was wrong twice over. `toLocaleString()` with
   * no locale groups by whatever the *browser* is set to, so total revenue of
   * 1234567 rendered ₹1,234,567 for most visitors and ₹12,34,567 for one on
   * an en-IN browser — only the second of which is how a rupee figure is
   * written. And `|| 0` turned a KPI that failed to load into a confident ₹0;
   * a dashboard must not report zero revenue when what it means is that it
   * does not know.
   *
   * formatMoney takes the locale from the currency table and renders — for an
   * absent value. The 0 minimum keeps whole rupees free of a trailing .00.
   */
  const money = (value) => formatMoney(value, { minimumFractionDigits: 0 });

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <h1 className="admin-dashboard__title">Admin Dashboard</h1>
          <p className="admin-dashboard__subtitle">
            Real-time analytics and store performance
          </p>
        </div>
      </header>

      {error && (
        <div className="admin-dashboard__error">
          <p>{error}</p>
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <section className="admin-dashboard__kpis">
        <AdminKpiCard
          icon="💰"
          label="Total Revenue"
          value={loading ? undefined : money(stats?.totalRevenue)}
          loading={loading}
        />
        <AdminKpiCard
          icon="📦"
          label="Total Orders"
          value={loading ? undefined : stats?.totalOrders?.toLocaleString()}
          loading={loading}
        />
        <AdminKpiCard
          icon="👥"
          label="Total Users"
          value={loading ? undefined : stats?.totalUsers?.toLocaleString()}
          loading={loading}
        />
        <AdminKpiCard
          icon="📚"
          label="Books in Catalogue"
          value={loading ? undefined : stats?.totalBooks?.toLocaleString()}
          loading={loading}
        />
        <AdminKpiCard
          icon="🧾"
          label="Avg. Order Value"
          value={loading ? undefined : money(stats?.avgOrderValue)}
          loading={loading}
        />
      </section>

      {/* ── Sales Chart ────────────────────────────────────────────── */}
      <section className="admin-dashboard__section">
        <AdminSalesChart />
      </section>

      {/* ── Two-column: Top Books + Recent Orders ──────────────────── */}
      <section className="admin-dashboard__grid">
        <div className="admin-dashboard__col">
          <AdminTopBooks />
        </div>
        <div className="admin-dashboard__col">
          <AdminRecentOrders />
        </div>
      </section>
    </main>
  );
}
