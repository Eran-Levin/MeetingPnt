import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader.js';
import { useAuthStore } from '../store/authStore.js';
import { ConfirmEmailNotice } from './ConfirmEmailNotice.js';
import { OverdueActivityPrompt } from './OverdueActivityPrompt.js';

export function AuthenticatedLayout() {
  const user = useAuthStore((s) => s.user);
  // A leader who signed up on their own gets this instead of the app until they confirm their
  // address. The header stays, so they can still change language or sign out.
  if (user?.role === 'leader' && !user.emailVerified) {
    return (
      <div className="min-h-screen bg-surface-sunken">
        <AppHeader />
        <ConfirmEmailNotice />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken">
      <AppHeader />
      {/* Sits under the header on every page: a forgotten live event has to be closable from
          wherever the leader happens to arrive. */}
      <OverdueActivityPrompt />
      <Outlet />
    </div>
  );
}
