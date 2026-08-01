import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { activityInvitationsApi } from '../api/activityInvitationsApi.js';
import { ApiError } from '../api/client.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';

interface Props {
  activityId: string;
}

const fieldClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

/**
 * Invites someone to this one activity without adding them to the group. Once they have an
 * account they appear in the RSVP dashboard above, tagged as a visitor — so this panel only
 * covers adding them and chasing invitations that haven't been accepted yet.
 */
export function ActivityVisitorsPanel({ activityId }: Props) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const invitationsQuery = useQuery({
    queryKey: ['activities', activityId, 'invitations'],
    queryFn: () => activityInvitationsApi.listPending(activityId),
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setInviting(true);
    try {
      const result = await activityInvitationsApi.invite(activityId, {
        email,
        firstName,
        lastName,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      const who = `${firstName} ${lastName}`.trim();
      setMessage(
        result.type === 'added'
          ? `${who} added as a visitor — they're now in the RSVP list.`
          : `Invitation sent to ${who} at ${email}.`,
      );
      setEmail('');
      setFirstName('');
      setLastName('');
      setPhone('');
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'rsvps'] });
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'invitations'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to invite visitor');
    } finally {
      setInviting(false);
    }
  }

  return (
    <Card className="mt-3">
      <p className="text-sm font-medium text-slate-700">Invite a visitor</p>
      <p className="mt-1 text-xs text-slate-500">
        Someone joining just this activity, without joining the group.
      </p>

      <form onSubmit={handleInvite} className="mt-3 flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className={fieldClass}
          />
          <input
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            placeholder="visitor@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={`flex-1 ${fieldClass}`}
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`flex-1 ${fieldClass}`}
          />
          <Button type="submit" disabled={inviting}>
            {inviting ? 'Sending…' : 'Invite'}
          </Button>
        </div>
      </form>
      {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {invitationsQuery.data && invitationsQuery.data.invitations.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Awaiting sign-up
          </p>
          {invitationsQuery.data.invitations.map((invitation) => (
            <p key={invitation.id} className="mt-1 text-sm text-slate-500">
              {invitation.email}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
