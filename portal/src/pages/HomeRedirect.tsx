import { Navigate } from 'react-router-dom';
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
    <div style={{ padding: 24 }}>
      <h1>MeetingPnt</h1>
      <p>
        This account doesn&rsquo;t have Leader or Admin access. Group members use the MeetingPnt
        mobile app instead.
      </p>
    </div>
  );
}
