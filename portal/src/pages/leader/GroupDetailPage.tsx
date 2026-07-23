import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { groupsApi } from '../../api/groupsApi.js';
import { invitationsApi } from '../../api/invitationsApi.js';
import { ApiError } from '../../api/client.js';
import { useAuthStore } from '../../store/authStore.js';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const groupId = id!;
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const groupQuery = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.get(groupId),
  });
  const membersQuery = useQuery({
    queryKey: ['groups', groupId, 'members'],
    queryFn: () => groupsApi.listMembers(groupId),
  });
  const invitationsQuery = useQuery({
    queryKey: ['groups', groupId, 'invitations'],
    queryFn: () => invitationsApi.listPending(groupId),
  });
  const activitiesQuery = useQuery({
    queryKey: ['groups', groupId, 'activities'],
    queryFn: () => activitiesApi.list(groupId),
  });

  const isLeader = groupQuery.data?.group.leaderId === currentUser?.id;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMessage(null);
    setInviteError(null);
    setInviting(true);
    try {
      const result = await invitationsApi.invite(groupId, { email });
      setInviteMessage(
        result.type === 'added'
          ? `${email} was added to the group.`
          : `Invitation sent to ${email}.`,
      );
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'invitations'] });
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    await groupsApi.removeMember(groupId, userId);
    queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'members'] });
  }

  async function handleRevoke(invitationId: string) {
    await invitationsApi.revoke(invitationId);
    queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'invitations'] });
  }

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <Link to="/groups">&larr; Groups</Link>
      <h1>{groupQuery.data?.group.name ?? '…'}</h1>
      {groupQuery.data?.group.description && <p>{groupQuery.data.group.description}</p>}

      {isLeader && (
        <>
          <h2>Invite a member</h2>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              placeholder="member@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: 8, flex: 1 }}
            />
            <button type="submit" disabled={inviting}>
              {inviting ? 'Sending…' : 'Invite'}
            </button>
          </form>
          {inviteMessage && <p style={{ color: 'green' }}>{inviteMessage}</p>}
          {inviteError && <p style={{ color: 'crimson' }}>{inviteError}</p>}
        </>
      )}

      <h2>Roster</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {membersQuery.data?.members.map((member) => (
          <li
            key={member.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: '1px solid #eee',
            }}
          >
            <span>
              {member.user.name} ({member.user.email})
            </span>
            {isLeader && member.userId !== groupQuery.data?.group.leaderId && (
              <button onClick={() => handleRemoveMember(member.userId)}>Remove</button>
            )}
          </li>
        ))}
      </ul>

      {isLeader && invitationsQuery.data && invitationsQuery.data.invitations.length > 0 && (
        <>
          <h2>Pending invitations</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {invitationsQuery.data.invitations.map((invitation) => (
              <li
                key={invitation.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid #eee',
                }}
              >
                <span>{invitation.email}</span>
                <button onClick={() => handleRevoke(invitation.id)}>Revoke</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Activities</h2>
        {isLeader && <Link to={`/groups/${groupId}/activities/new`}>+ New activity</Link>}
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {activitiesQuery.data?.activities.map((activity) => (
          <li
            key={activity.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: '1px solid #eee',
            }}
          >
            <Link to={`/activities/${activity.id}`}>{activity.title}</Link>
            <span style={{ color: '#888' }}>
              {new Date(activity.startAt).toLocaleString()} · {activity.status}
            </span>
          </li>
        ))}
        {activitiesQuery.data?.activities.length === 0 && (
          <p style={{ color: '#888' }}>No activities scheduled yet.</p>
        )}
      </ul>
    </div>
  );
}
