import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { AppLogo } from '../components/AppLogo.js';
import { Card } from '../components/ui/Card.js';
import { apiErrorMessage, useTranslation } from '../i18n/index.js';
import { useAuthStore } from '../store/authStore.js';

/**
 * Where the link in the confirmation email lands. It confirms on arrival — the click was the
 * decision. Works signed in or not: the link is often opened on a different device from the one
 * that signed up, and that device's tab picks the change up by itself.
 */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'checking' | 'confirmed' | 'failed'>('checking');
  const [error, setError] = useState('');
  // React's development double-run would otherwise send the request twice.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    authApi
      .verifyEmail(token)
      .then(({ user }) => {
        // If this browser is signed in as that person, let it through without a reload.
        const { user: current, setUser } = useAuthStore.getState();
        if (current?.id === user.id) setUser(user);
        setState('confirmed');
      })
      .catch((err) => {
        setError(apiErrorMessage(err, t('common.somethingWentWrong')));
        setState('failed');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4 py-8">
      <Card className="w-full max-w-sm">
        <AppLogo size={48} className="mb-1" />
        {state === 'checking' && (
          <p role="status" className="text-sm text-ink-secondary">
            {t('verifyEmail.checking')}
          </p>
        )}
        {state === 'confirmed' && (
          <>
            <h1 className="text-2xl font-semibold text-ink">{t('verifyEmail.confirmedTitle')}</h1>
            <p className="mt-1 text-sm text-ink-secondary">{t('verifyEmail.confirmedBody')}</p>
            <Link to="/" className="mt-5 inline-block text-sm font-medium text-accent-text underline">
              {t('verifyEmail.continue')}
            </Link>
          </>
        )}
        {state === 'failed' && (
          <>
            <h1 className="text-2xl font-semibold text-ink">{t('verifyEmail.title')}</h1>
            <p role="alert" className="mt-2 text-sm text-tone-danger-fg">
              {error}
            </p>
            <Link to="/login" className="mt-5 inline-block text-sm font-medium text-accent-text underline">
              {t('portal.landing.signIn')}
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
