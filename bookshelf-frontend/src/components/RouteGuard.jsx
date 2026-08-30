import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

/**
 * The one route guard.
 *
 * `ProtectedRoute` and `AdminRoute` were the same component written twice —
 * same loading branch, same "not signed in, go to login with a redirect
 * back", same role check. Having two of them is how they drifted: only one
 * had `aria-busy` on its loading state, and only one was ever actually used
 * on the route that needed a role check.
 *
 * They are both thin wrappers over this now, so a fix to the redirect
 * behaviour lands in one place and cannot apply to half the routes.
 *
 * @param {object}  props
 * @param {boolean} props.requireAdmin  also require the admin role
 * @param {node}    props.children      what to render once the checks pass
 */
export default function RouteGuard({ children, requireAdmin = false }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  /*
   * Nothing is decided while the session is still being restored.
   *
   * Redirecting here would bounce a signed-in admin to the home page on every
   * hard refresh of an admin URL, because `user` is null until the profile
   * request comes back.
   */
  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}
        aria-busy="true"
      >
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    /*
     * Carry where they were going, so signing in returns them to it rather
     * than to the home page. `location.pathname` only — a search string or a
     * hash would need encoding, and no guarded route uses one today.
     */
    return <Navigate to={`/login?redirect=${location.pathname}`} replace />;
  }

  /*
   * A signed-in non-admin goes home rather than to the login page: they are
   * already signed in, and sending them to a login form implies that signing
   * in again would help. It would not.
   */
  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
