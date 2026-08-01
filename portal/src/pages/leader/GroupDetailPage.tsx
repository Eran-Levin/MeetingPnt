import type { GroupChatMode, GroupStatus } from '@meetingpnt/shared';
import { formatActivityWhen } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { groupsApi } from '../../api/groupsApi.js';
import { invitationsApi } from '../../api/invitationsApi.js';
import { ApiError } from '../../api/client.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { GroupChatPanel } from '../../components/GroupChatPanel.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { Select } from '../../components/ui/Select.js';
import { useAuthStore } from '../../store/authStore.js';

const CHAT_MODES: GroupChatMode[] = ['two_way', 'announcements'];

const inviteFieldClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const groupId = id!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [deleting, setDeleting] = useState(false);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
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
      const result = await invitationsApi.invite(groupId, {
        email,
        firstName,
        lastName,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      const who = `${firstName} ${lastName}`.trim();
      setInviteMessage(
        result.type === 'added'
          ? `${who} was added to the group.`
          : `Invitation sent to ${who} at ${email}.`,
      );
      setEmail('');
      setFirstName('');
      setLastName('');
      setPhone('');
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

  async function handleStatusChange(status: GroupStatus) {
    await groupsApi.update(groupId, { status });
    queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  }

  async function handleChatModeChange(chatMode: GroupChatMode) {
    await groupsApi.update(groupId, { chatMode });
    queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
  }

  async function handleDeleteGroup() {
    const confirmed = window.confirm(
      `Delete "${groupQuery.data?.group.name}"? This removes the group, its roster, activities, and meeting points. This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await groupsApi.remove(groupId);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      navigate('/groups');
    } finally {
      setDeleting(false);
    }
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
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {groupQuery.data?.group.name ?? '…'}
          </h1>
          {groupQuery.data?.group.description && (
            <p className="mt-1 text-sm text-slate-500">{groupQuery.data.group.description}</p>
          )}
        </div>
        {groupQuery.data && (
          <div className="flex shrink-0 items-center gap-2">
            <Badge status={groupQuery.data.group.status} />
            {/* Planned vs in progress follows the events, so the only status call left to the
                leader is whether the group is finished with. */}
            {isLeader &&
              (groupQuery.data.group.status === 'completed' ? (
                <Button variant="secondary" size="sm" onClick={() => handleStatusChange('planned')}>
                  Reopen group
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleStatusChange('completed')}
                >
                  Close group
                </Button>
              ))}
            {isLeader && (
              <Select
                value={groupQuery.data.group.chatMode}
                onChange={(e) => handleChatModeChange(e.target.value as GroupChatMode)}
                className="py-1.5"
              >
                {CHAT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === 'two_way' ? 'two-way chat' : 'announcements only'}
                  </option>
                ))}
              </Select>
            )}
            {isLeader && (
              <Button variant="danger" size="sm" disabled={deleting} onClick={handleDeleteGroup}>
                {deleting ? 'Deleting…' : 'Delete group'}
              </Button>
            )}
          </div>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Roster</h2>
        <Card className="mt-3 divide-y divide-slate-100 p-0">
          {membersQuery.data?.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-4 py-3">
              <div className="text-sm">
                <span className="text-slate-700">{member.user.name}</span>{' '}
                <span className="text-slate-400">({member.user.email})</span>
                {member.user.phone && (
                  <a
                    href={`tel:${member.user.phone}`}
                    className="ml-2 text-slate-500 hover:text-blue-600 hover:underline"
                  >
                    {member.user.phone}
                  </a>
                )}
              </div>
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
            {/* The leader already knows who they're adding, so the roster is complete from the
                moment the invitation goes out rather than after the invitee signs up. */}
            <form onSubmit={handleInvite} className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className={inviteFieldClass}
                />
                <input
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className={inviteFieldClass}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  placeholder="member@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`flex-1 ${inviteFieldClass}`}
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`flex-1 ${inviteFieldClass}`}
                />
                <Button type="submit" disabled={inviting}>
                  {inviting ? 'Sending…' : 'Invite member'}
                </Button>
              </div>
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
                  {formatActivityWhen(activity.startAt, activity.endAt, activity.allDay)}
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
                      <span>{formatActivityWhen(activity.startAt, activity.endAt, activity.allDay)}</span>
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

      {groupQuery.data && (
        <GroupChatPanel groupId={groupId} chatMode={groupQuery.data.group.chatMode} isLeader={isLeader} />
      )}
    </PageContainer>
  );
}
