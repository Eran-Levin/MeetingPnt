import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader.js';

export function AuthenticatedLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <Outlet />
    </div>
  );
}
