import { Link, useLocation } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { LOCALES, type Locale } from '@meetingpnt/shared';
import { usersApi } from '../api/usersApi.js';
import { useAuthStore } from '../store/authStore.js';
import { AppLogo } from './AppLogo.js';

/** Each language is named in itself — someone who can't read the current UI language can still find theirs. */
const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', he: 'עברית' };

export function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setUser = useAuthStore((s) => s.setUser);
  const { pathname } = useLocation();

  async function handleLocale(locale: Locale) {
    const { user: updated } = await usersApi.setLocale(locale);
    setUser(updated);
  }

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

        <div className="ms-auto flex items-center gap-4">
          {user && (
            <select
              aria-label="Language"
              value={user.locale}
              onChange={(e) => handleLocale(e.target.value as Locale)}
              className="rounded border border-line bg-surface px-2 py-1 text-sm text-ink-secondary"
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_NAMES[l]}
                </option>
              ))}
            </select>
          )}
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
