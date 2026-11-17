import { useEffect, useState } from 'react';
import { authApi } from '../api/authApi.js';
import { apiErrorMessage, useTranslation } from '../i18n/index.js';
import { useAuthStore } from '../store/authStore.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';
import { PageContainer } from './ui/PageContainer.js';

/**
 * What a newly signed-up leader sees in place of the app until they open the link sent to their
 * address. The link is usually opened in another tab — or on a phone — so this one notices on its
 * own when they come back to it, and "I have confirmed" is there for when it doesn't.
 */
export function ConfirmEmailNotice() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /** Re-reads the account. Returns whether it is confirmed now. */
  async function recheck() {
    const { user: fresh } = await authApi.me();
    setUser(fresh);
    return fresh.emailVerified;
  }

  useEffect(() => {
    const onFocus = () => void recheck().catch(() => undefined);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResend() {
    setBusy(true);
    setNote(null);
    try {
      await authApi.resendVerification();
      setNote({ tone: 'ok', text: t('verifyEmail.resent') });
    } catch (err) {
      setNote({ tone: 'error', text: apiErrorMessage(err, t('common.somethingWentWrong')) });
    } finally {
      setBusy(false);
    }
  }

  async function handleDone() {
    setBusy(true);
    setNote(null);
    try {
      if (!(await recheck())) setNote({ tone: 'error', text: t('verifyEmail.notYet') });
    } catch (err) {
      setNote({ tone: 'error', text: apiErrorMessage(err, t('common.somethingWentWrong')) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer>
      <Card className="mx-auto mt-10 max-w-md">
        <h1 className="text-xl font-semibold text-ink">{t('verifyEmail.title')}</h1>
        <p className="mt-2 text-sm text-ink">
          {t('verifyEmail.body', { email: user?.email ?? '' })}
        </p>
        <p className="mt-1 text-sm text-ink-secondary">{t('verifyEmail.spam')}</p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={handleDone} disabled={busy}>
            {t('verifyEmail.done')}
          </Button>
          <Button variant="secondary" onClick={handleResend} disabled={busy}>
            {t('verifyEmail.resend')}
          </Button>
        </div>

        {note && (
          <p
            role="status"
            className={`mt-4 text-sm ${note.tone === 'error' ? 'text-tone-danger-fg' : 'text-tone-success-fg'}`}
          >
            {note.text}
          </p>
        )}
      </Card>
    </PageContainer>
  );
}
