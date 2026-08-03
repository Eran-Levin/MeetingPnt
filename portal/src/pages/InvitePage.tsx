import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { invitationsApi } from '../api/invitationsApi.js';
import { AppLogo } from '../components/AppLogo.js';
import { Card } from '../components/ui/Card.js';

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
  const [params] = useSearchParams();
  const token = params.get('token');

  const { data, isLoading, error } = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => invitationsApi.preview(token!),
    enabled: !!token,
    retry: false,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md">
        <AppLogo className="mb-6" />

        {!token && (
          <p className="text-sm text-slate-600">
            This invitation link is missing its code. Ask whoever invited you to send it again.
          </p>
        )}

        {token && isLoading && <p className="text-sm text-slate-500">Checking your invitation…</p>}

        {token && error && (
          <>
            <h1 className="text-xl font-semibold text-slate-900">This invitation has expired</h1>
            <p className="mt-2 text-sm text-slate-600">
              Invitations last seven days. Ask the group leader to send you a new one.
            </p>
          </>
        )}

        {data && (
          <>
            <h1 className="text-xl font-semibold text-slate-900">
              You&rsquo;re invited to join {data.group.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              MeetingPnt is how the group shares where to meet, who&rsquo;s coming, and where
              everyone is once the day starts. The invitation is for {data.email}.
            </p>

            <a
              href={data.appLink}
              className="mt-6 block rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              Open in the MeetingPnt app
            </a>

            {/* No store listing yet, so this says what's true rather than linking somewhere
                that 404s. It becomes a store button when the app is distributed. */}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="text-sm font-medium text-slate-700">Don&rsquo;t have the app yet?</p>
              <p className="mt-1 text-sm text-slate-600">
                MeetingPnt runs on your phone. Install it, then open this same link again on the
                phone — your invitation will still be waiting.
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
