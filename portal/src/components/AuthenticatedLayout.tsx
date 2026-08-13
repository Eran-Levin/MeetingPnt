import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader.js';

export function AuthenticatedLayout() {
  return (
    <div className="min-h-screen bg-surface-sunken">
      <AppHeader />
      <Outlet />
    </div>
  );
}
