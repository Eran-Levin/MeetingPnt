import { Link, useLocation } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { useAuthStore } from '../store/authStore.js';
import { AppLogo } from './AppLogo.js';

export function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const { pathname } = useLocation();

  async function handleLogout() {
    await authApi.logout();
    clearSession();
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold text-ink">
          <AppLogo size={28} />
          MeetingPnt
        </Link>

        <nav className="flex items-center gap-1">
          {(user?.role === 'leader' || user?.role === 'admin') && (
            <>
              <NavLink to="/groups" active={pathname.startsWith('/groups')}>
                Groups
              </NavLink>
              {/* The list is /activities and a single one is /activities/:id, so one prefix
                  lights the tab from either. */}
              <NavLink to="/activities" active={pathname.startsWith('/activities')}>
                Activities
              </NavLink>
              <NavLink to="/analysis" active={pathname.startsWith('/analysis')}>
                Analysis
              </NavLink>
            </>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/admin/users" active={pathname.startsWith('/admin')}>
              Users
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm text-ink-secondary">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-ink-secondary hover:text-ink"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

/** Which section you're in should be visible without reading the URL. */
function NavLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-accent-surface text-accent-text'
          : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}
