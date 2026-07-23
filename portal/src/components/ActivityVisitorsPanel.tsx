import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { activityInvitationsApi } from '../api/activityInvitationsApi.js';
import { ApiError } from '../api/client.js';

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
    <div style={{ marginTop: 24 }}>
      <h2>Visitors</h2>
      <p style={{ color: '#888', marginTop: -8 }}>
        People invited to just this activity, without joining the group.
      </p>

      <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          placeholder="visitor@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 8, flex: 1 }}
        />
        <button type="submit" disabled={inviting}>
          {inviting ? 'Sending…' : 'Invite visitor'}
        </button>
      </form>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
        {guestsQuery.data?.guests.map((guest) => (
          <li key={guest.id} style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
            {guest.user.name} ({guest.user.email})
          </li>
        ))}
      </ul>

      {invitationsQuery.data && invitationsQuery.data.invitations.length > 0 && (
        <>
          <p style={{ fontWeight: 600, marginTop: 12 }}>Pending</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {invitationsQuery.data.invitations.map((invitation) => (
              <li key={invitation.id} style={{ padding: '6px 0', color: '#888' }}>
                {invitation.email}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
