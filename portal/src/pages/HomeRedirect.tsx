import { Navigate } from 'react-router-dom';
import { Card } from '../components/ui/Card.js';
import { useTranslation } from '../i18n/index.js';
import { useAuthStore } from '../store/authStore.js';

export function HomeRedirect() {
  const { t } = useTranslation();
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
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      <Card className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-ink">MeetingPnt</h1>
        <p className="mt-2 text-sm text-ink-secondary">{t('portal.noAccess')}</p>
      </Card>
    </div>
  );
}
