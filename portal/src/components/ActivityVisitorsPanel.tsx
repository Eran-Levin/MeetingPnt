import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { activityInvitationsApi } from '../api/activityInvitationsApi.js';
import { ApiError } from '../api/client.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';

interface Props {
  activityId: string;
}

export function ActivityVisitorsPanel({ activityId }: Props) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const guestsQuery = useQuery({
    queryKey: ['activities', activityId, 'guests'],
    queryFn: () => activityInvitationsApi.listGuests(activityId),
  });
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
      const result = await activityInvitationsApi.invite(activityId, { email });
      setMessage(
        result.type === 'added' ? `${email} added as a visitor.` : `Invitation sent to ${email}.`,
      );
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'guests'] });
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'invitations'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to invite visitor');
    } finally {
      setInviting(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">Visitors</h2>
      <p className="mt-1 text-sm text-slate-500">
        People invited to just this activity, without joining the group.
      </p>

      <Card className="mt-3">
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            placeholder="visitor@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button type="submit" disabled={inviting}>
            {inviting ? 'Sending…' : 'Invite visitor'}
          </Button>
        </form>
        {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Card>

      {(guestsQuery.data?.guests.length ?? 0) > 0 && (
        <Card className="mt-3 divide-y divide-slate-100 p-0">
          {guestsQuery.data?.guests.map((guest) => (
            <div key={guest.id} className="px-4 py-3 text-sm text-slate-700">
              {guest.user.name} <span className="text-slate-400">({guest.user.email})</span>
            </div>
          ))}
        </Card>
      )}

      {invitationsQuery.data && invitationsQuery.data.invitations.length > 0 && (
        <Card className="mt-3 divide-y divide-slate-100 p-0">
          <p className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">Pending</p>
          {invitationsQuery.data.invitations.map((invitation) => (
            <div key={invitation.id} className="px-4 py-3 text-sm text-slate-500">
              {invitation.email}
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
