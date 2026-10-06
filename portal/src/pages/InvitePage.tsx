import { isolate } from '@meetingpnt/shared';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { invitationsApi } from '../api/invitationsApi.js';
import { AppLogo } from '../components/AppLogo.js';
import { Card } from '../components/ui/Card.js';
import { useTranslation } from '../i18n/index.js';

/**
 * Where an invitation link lands. Public — the whole point is that whoever opens it has no
 * account yet, and quite possibly no app.
 *
 * The link used to be a bare `meetingpnt://` custom scheme, which on a phone without the app
 * does nothing whatsoever: no error, no prompt, no store. Since almost everyone receiving an
 * invitation is by definition a new user, that failed in the common case. This page is the https
 * destination instead, and hands off to the app for the minority who already have it.
 */
export function InvitePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token');

  const { data, isLoading, error } = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => invitationsApi.preview(token!),
    enabled: !!token,
    retry: false,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken p-6">
      <Card className="w-full max-w-md">
        <AppLogo className="mb-6" />

        {!token && (
          <p className="text-sm text-ink-secondary">{t('portal.invite.missing')}</p>
        )}

        {token && isLoading && <p className="text-sm text-ink-secondary">{t('portal.invite.checking')}</p>}

        {token && error && (
          <>
            <h1 className="text-xl font-semibold text-ink">{t('portal.invite.expiredTitle')}</h1>
            <p className="mt-2 text-sm text-ink-secondary">{t('portal.invite.expiredBody')}</p>
          </>
        )}

        {data && (
          <>
            <h1 className="text-xl font-semibold text-ink">
              {t('portal.invite.title', { group: isolate(data.group.name) })}
            </h1>
            <p className="mt-2 text-sm text-ink-secondary">
              {t('portal.invite.body', { email: isolate(data.email) })}
            </p>

            <a
              href={data.appLink}
              className="mt-6 block rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-white hover:bg-accent-strong"
            >
              {t('portal.invite.openApp')}
            </a>

            {/* No store listing yet, so this says what's true rather than linking somewhere
                that 404s. It becomes a store button when the app is distributed. */}
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-sm font-medium text-ink">{t('portal.invite.noAppTitle')}</p>
              <p className="mt-1 text-sm text-ink-secondary">{t('portal.invite.noAppBody')}</p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
