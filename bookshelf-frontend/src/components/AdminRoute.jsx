import RouteGuard from './RouteGuard.jsx';

/**
 * AdminRoute — a route guard that requires both authentication and the
 * admin role.
 *
 * Usage:
 *   <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
 *
 * It was written, given its own test file, and then mounted on nothing:
 * `/admin/inventory` — the page that creates, edits and deletes books — was
 * guarded by a bare `<ProtectedRoute>`, which only checks that *somebody* is
 * signed in, so any registered customer could open it. See #420.
 *
 * The guard itself lives in RouteGuard.jsx, which this and ProtectedRoute
 * both wrap: they were the same component written twice, and only one of
 * them had `aria-busy` on its loading state.
 */
export default function AdminRoute({ children }) {
  return <RouteGuard requireAdmin>{children}</RouteGuard>;
}
