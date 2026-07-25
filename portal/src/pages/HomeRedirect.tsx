import { Navigate } from 'react-router-dom';
import { Card } from '../components/ui/Card.js';
import { useAuthStore } from '../store/authStore.js';

export function HomeRedirect() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/admin/users" replace />;
  }

  if (user.role === 'leader') {
    return <Navigate to="/groups" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-slate-900">MeetingPnt</h1>
        <p className="mt-2 text-sm text-slate-500">
          This account doesn&rsquo;t have Leader or Admin access. Group members use the MeetingPnt
          mobile app instead.
        </p>
      </Card>
    </div>
  );
}
