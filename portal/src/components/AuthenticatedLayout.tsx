import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader.js';
import { OverdueActivityPrompt } from './OverdueActivityPrompt.js';

export function AuthenticatedLayout() {
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
