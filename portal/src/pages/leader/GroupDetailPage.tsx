import type { GroupChatMode, GroupStatus } from '@meetingpnt/shared';
import { formatActivityWhen } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { ApiError } from '../../api/client.js';
import { groupsApi } from '../../api/groupsApi.js';
import { invitationsApi } from '../../api/invitationsApi.js';
import { GroupChatPanel } from '../../components/GroupChatPanel.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { Select } from '../../components/ui/Select.js';
import { EmptyState, SkeletonRows } from '../../components/ui/Skeleton.js';
import { TextField } from '../../components/ui/TextField.js';
import { useAuthStore } from '../../store/authStore.js';

const CHAT_MODES: GroupChatMode[] = ['two_way', 'announcements'];

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

  const members = membersQuery.data?.members ?? [];
  const activities = activitiesQuery.data?.activities ?? [];
  const standaloneActivities = activities.filter((a) => !a.seriesId);
  const seriesGroups = new Map<string, typeof standaloneActivities>();
  for (const activity of activities) {
    if (!activity.seriesId) continue;
    seriesGroups.set(activity.seriesId, [...(seriesGroups.get(activity.seriesId) ?? []), activity]);
  }

  return (
    <PageContainer wide>
      <Link to="/groups" className="text-sm text-accent-text hover:underline">
        &larr; Groups
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {groupQuery.data?.group.name ?? '…'}
          </h1>
          {groupQuery.data?.group.description && (
            <p className="mt-1 text-sm text-ink-secondary">{groupQuery.data.group.description}</p>
          )}
        </div>
        {groupQuery.data && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/* Open groups say nothing — a badge reading "planned" on every group was noise.
                Closed is the only state worth announcing, because it changes what the page is:
                a record rather than a plan. For a guide it's the end of the trip. */}
            {groupQuery.data.group.status === 'completed' && (
              <span className="rounded-full bg-tone-neutral-bg px-2.5 py-0.5 text-xs font-medium text-tone-neutral-fg">
                Closed
              </span>
            )}
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

      {/* Who's in the group and what they're booked onto are the two halves of planning, and on a
          browser there's room to hold both in view at once. */}
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)]">
        <section>
          <h2 className="text-lg font-semibold text-ink">
            Roster <span className="text-sm font-normal text-ink-muted">{members.length}</span>
          </h2>

          {membersQuery.isLoading ? (
            <div className="mt-3">
              <SkeletonRows rows={3} />
            </div>
          ) : members.length > 0 ? (
            <Card className="mt-3 divide-y divide-line p-0">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="truncate text-ink">{member.user.name}</p>
                    <p className="truncate text-ink-muted">
                      {member.user.email}
                      {member.user.phone && (
                        <>
                          {' · '}
                          <a
                            href={`tel:${member.user.phone}`}
                            className="text-ink-secondary hover:text-accent-text hover:underline"
                          >
                            {member.user.phone}
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  {isLeader && member.userId !== groupQuery.data?.group.leaderId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.userId)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          ) : (
            <div className="mt-3">
              <EmptyState
                headline="Nobody on the roster yet"
                body={isLeader ? 'Invite someone below — they appear straight away.' : undefined}
              />
            </div>
          )}

          {isLeader && (
            <Card className="mt-3">
              {/* The leader already knows who they're adding, so the roster is complete from the
                  moment the invitation goes out rather than after the invitee signs up. */}
              <form onSubmit={handleInvite} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField
                    label="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <TextField
                    label="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField
                    label="Email"
                    type="email"
                    placeholder="member@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <TextField
                    label="Phone (optional)"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={inviting} className="self-start">
                  {inviting ? 'Sending…' : 'Invite member'}
                </Button>
              </form>
              {inviteMessage && (
                <p className="mt-2 text-sm text-tone-success-fg">{inviteMessage}</p>
              )}
              {inviteError && <p className="mt-2 text-sm text-tone-danger-fg">{inviteError}</p>}
            </Card>
          )}

          {isLeader && invitationsQuery.data && invitationsQuery.data.invitations.length > 0 && (
            <Card className="mt-3 divide-y divide-line p-0">
              <p className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                Pending invitations
              </p>
              {invitationsQuery.data.invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-ink-secondary">{invitation.email}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleRevoke(invitation.id)}>
                    Revoke
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Events</h2>
            {isLeader && (
              <Link to={`/groups/${groupId}/activities/new`}>
                <Button size="sm">New event</Button>
              </Link>
            )}
          </div>

          {activitiesQuery.isLoading ? (
            <div className="mt-3">
              <SkeletonRows rows={4} />
            </div>
          ) : activities.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                headline="Nothing scheduled yet"
                body={
                  isLeader
                    ? 'Plan an event here, then publish it when the group should see it.'
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {standaloneActivities.map((activity) => (
                <Link key={activity.id} to={`/activities/${activity.id}`}>
                  <Card className="flex flex-wrap items-center justify-between gap-2 transition-shadow hover:shadow-md">
                    <span className="font-medium text-ink">{activity.title}</span>
                    <span className="flex items-center gap-2 text-sm text-ink-secondary">
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink">
                        {occurrences[0]!.title}{' '}
                        <span className="font-normal text-ink-muted">
                          (recurring, {occurrences.length} occurrences)
                        </span>
                      </p>
                      {isLeader && draftCount > 0 && (
                        <Button size="sm" onClick={() => handlePublishSeries(seriesId)}>
                          Publish all ({draftCount} draft{draftCount > 1 ? 's' : ''})
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 flex flex-col divide-y divide-line">
                      {occurrences.map((activity) => (
                        <Link
                          key={activity.id}
                          to={`/activities/${activity.id}`}
                          className="flex items-center justify-between py-2 text-sm hover:text-accent-text"
                        >
                          <span>
                            {formatActivityWhen(activity.startAt, activity.endAt, activity.allDay)}
                          </span>
                          <Badge status={activity.status} />
                        </Link>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {groupQuery.data && (
        <GroupChatPanel
          groupId={groupId}
          chatMode={groupQuery.data.group.chatMode}
          isLeader={isLeader}
        />
      )}
    </PageContainer>
  );
}
