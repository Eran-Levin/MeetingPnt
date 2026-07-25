import { Link } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { useAuthStore } from '../store/authStore.js';
import { AppLogo } from './AppLogo.js';

export function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  async function handleLogout() {
    await authApi.logout();
    clearSession();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <AppLogo size={28} />
          Meeting<span className="text-blue-600">Pnt</span>
        </Link>
        <nav className="flex items-center gap-5">
          {user?.role === 'admin' && (
            <Link to="/admin/users" className="text-sm text-slate-600 hover:text-slate-900">
              Users
            </Link>
          )}
          {(user?.role === 'leader' || user?.role === 'admin') && (
            <Link to="/groups" className="text-sm text-slate-600 hover:text-slate-900">
              Groups
            </Link>
          )}
          <span className="text-sm text-slate-500">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
