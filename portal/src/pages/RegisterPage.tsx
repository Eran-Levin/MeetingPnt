import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { AppLogo } from '../components/AppLogo.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { TextField } from '../components/ui/TextField.js';
import { apiErrorMessage, useLocale, useTranslation } from '../i18n/index.js';
import { useAuthStore } from '../store/authStore.js';

/** Self-service sign-up for group leaders. Members never come through here — they arrive by invitation. */
export function RegisterPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth.register.passwordsDiffer'));
      return;
    }
    setSubmitting(true);
    try {
      const data = await authApi.register({
        firstName,
        lastName,
        email,
        password,
        asLeader: true,
        locale,
      });
      setSession(data.user, data.accessToken);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err, t('common.somethingWentWrong')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4 py-8">
      <Card className="w-full max-w-sm">
        <Link to="/" aria-label={t('portal.register.backHome')}>
          <AppLogo size={48} className="mb-1" />
        </Link>
        <h1 className="text-2xl font-semibold text-ink">{t('portal.register.title')}</h1>
        <p className="mt-1 text-sm text-ink-secondary">{t('portal.register.subtitle')}</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <TextField
            label={t('common.firstName')}
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <TextField
            label={t('common.lastName')}
            required
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <TextField
            label={t('common.email')}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label={t('common.password')}
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t('auth.register.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            label={t('auth.register.confirmPassword')}
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="text-sm text-tone-danger-fg">{error}</p>}
          <Button type="submit" disabled={submitting} className="mt-1 w-full">
            {submitting ? t('auth.register.submitting') : t('portal.register.submit')}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-accent-text hover:underline">
            {t('portal.register.haveAccount')}
          </Link>
        </p>
      </Card>
    </div>
  );
}
