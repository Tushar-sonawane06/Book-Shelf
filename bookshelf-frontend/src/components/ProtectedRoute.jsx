import RouteGuard from './RouteGuard.jsx';

/**
 * ProtectedRoute — requires a session, and optionally the admin role.
 *
 * `requireAdmin` is kept for the callers that pass it, but a route that needs
 * an admin should use `<AdminRoute>` instead: the prop defaults to `false`,
 * and forgetting it is silent. That is precisely how `/admin/inventory` came
 * to be reachable by any signed-in customer — the route said
 * `<ProtectedRoute>` and nobody noticed the missing prop. See #420.
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
  return <RouteGuard requireAdmin={requireAdmin}>{children}</RouteGuard>;
}
