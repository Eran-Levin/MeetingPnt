import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { AppLogo } from '../components/AppLogo.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { TextField } from '../components/ui/TextField.js';
import { apiErrorMessage, useTranslation } from '../i18n/index.js';
import { useAuthStore } from '../store/authStore.js';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await authApi.login({ email, password });
      setSession(data.user, data.accessToken);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err, t('common.somethingWentWrong')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      <Card className="w-full max-w-sm">
        <AppLogo size={48} className="mb-1" />
        <h1 className="text-2xl font-semibold text-ink">MeetingPnt</h1>
        <p className="mt-1 text-sm text-ink-secondary">{t('portal.loginSubtitle')}</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <TextField
            label={t('common.email')}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label={t('common.password')}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-tone-danger-fg">{error}</p>}
          <Button type="submit" disabled={submitting} className="mt-1 w-full">
            {submitting ? t('auth.login.signingIn') : t('auth.login.signIn')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
