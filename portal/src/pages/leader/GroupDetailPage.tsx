import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { groupsApi } from '../../api/groupsApi.js';
import { invitationsApi } from '../../api/invitationsApi.js';
import { ApiError } from '../../api/client.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
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

  async function handlePublishSeries(seriesId: string) {
    await activitiesApi.publishSeries(seriesId);
    queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'activities'] });
  }

  const standaloneActivities = activitiesQuery.data?.activities.filter((a) => !a.seriesId) ?? [];
  const seriesGroups = new Map<string, typeof standaloneActivities>();
  for (const activity of activitiesQuery.data?.activities ?? []) {
    if (!activity.seriesId) continue;
    seriesGroups.set(activity.seriesId, [...(seriesGroups.get(activity.seriesId) ?? []), activity]);
  }

  return (
    <PageContainer>
      <Link to="/groups" className="text-sm text-blue-600 hover:underline">
        &larr; Groups
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">
        {groupQuery.data?.group.name ?? '…'}
      </h1>
      {groupQuery.data?.group.description && (
        <p className="mt-1 text-sm text-slate-500">{groupQuery.data.group.description}</p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Roster</h2>
        <Card className="mt-3 divide-y divide-slate-100 p-0">
          {membersQuery.data?.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-700">
                {member.user.name}{' '}
                <span className="text-slate-400">({member.user.email})</span>
              </span>
              {isLeader && member.userId !== groupQuery.data?.group.leaderId && (
                <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.userId)}>
                  Remove
                </Button>
              )}
            </div>
          ))}
          {membersQuery.data?.members.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No members yet.</p>
          )}
        </Card>

        {isLeader && (
          <Card className="mt-3">
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                type="email"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Sending…' : 'Invite member'}
              </Button>
            </form>
            {inviteMessage && <p className="mt-2 text-sm text-green-600">{inviteMessage}</p>}
            {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
          </Card>
        )}

        {isLeader && invitationsQuery.data && invitationsQuery.data.invitations.length > 0 && (
          <Card className="mt-3 divide-y divide-slate-100 p-0">
            <p className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Pending invitations
            </p>
            {invitationsQuery.data.invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-600">{invitation.email}</span>
                <Button variant="ghost" size="sm" onClick={() => handleRevoke(invitation.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Activities</h2>
          {isLeader && (
            <Link to={`/groups/${groupId}/activities/new`} className="text-sm font-medium text-blue-600 hover:underline">
              + New activity
            </Link>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {standaloneActivities.map((activity) => (
            <Link key={activity.id} to={`/activities/${activity.id}`}>
              <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
                <span className="font-medium text-slate-900">{activity.title}</span>
                <span className="flex items-center gap-2 text-sm text-slate-500">
                  {new Date(activity.startAt).toLocaleString()}
                  <Badge status={activity.status} />
                </span>
              </Card>
            </Link>
          ))}

          {[...seriesGroups.entries()].map(([seriesId, occurrences]) => {
            const draftCount = occurrences.filter((o) => o.status === 'draft').length;
            return (
              <Card key={seriesId}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">
                    {occurrences[0]!.title}{' '}
                    <span className="font-normal text-slate-400">
                      (recurring, {occurrences.length} occurrences)
                    </span>
                  </p>
                  {isLeader && draftCount > 0 && (
                    <Button size="sm" onClick={() => handlePublishSeries(seriesId)}>
                      Publish all ({draftCount} draft{draftCount > 1 ? 's' : ''})
                    </Button>
                  )}
                </div>
                <div className="mt-2 flex flex-col divide-y divide-slate-100">
                  {occurrences.map((activity) => (
                    <Link
                      key={activity.id}
                      to={`/activities/${activity.id}`}
                      className="flex items-center justify-between py-2 text-sm hover:text-blue-600"
                    >
                      <span>{new Date(activity.startAt).toLocaleString()}</span>
                      <Badge status={activity.status} />
                    </Link>
                  ))}
                </div>
              </Card>
            );
          })}

          {activitiesQuery.data?.activities.length === 0 && (
            <p className="text-sm text-slate-400">No activities scheduled yet.</p>
          )}
        </div>
      </section>
    </PageContainer>
  );
}
