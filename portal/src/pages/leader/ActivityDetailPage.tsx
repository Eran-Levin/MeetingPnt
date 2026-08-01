import { formatActivityWhen } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { ApiError } from '../../api/client.js';
import { rsvpsApi } from '../../api/rsvpsApi.js';
import { groupsApi } from '../../api/groupsApi.js';
import { ActivityScheduleEditor } from '../../components/ActivityScheduleEditor.js';
import { ActivityVisitorsPanel } from '../../components/ActivityVisitorsPanel.js';
import { MeetingPointsPanel } from '../../components/MeetingPointsPanel.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { useAuthStore } from '../../store/authStore.js';

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const activityId = id!;
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [savingRsvpFor, setSavingRsvpFor] = useState<string | null>(null);

  const activityQuery = useQuery({
    queryKey: ['activities', activityId],
    queryFn: () => activitiesApi.get(activityId),
  });

  const groupId = activityQuery.data?.activity.groupId;

  const groupQuery = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.get(groupId!),
    enabled: !!groupId,
  });

  const isLeader = groupQuery.data?.group.leaderId === currentUser?.id;

  const rsvpsQuery = useQuery({
    queryKey: ['activities', activityId, 'rsvps'],
    queryFn: () => rsvpsApi.list(activityId),
    enabled: isLeader,
  });

  /**
   * Lifecycle actions fail for reasons the leader needs to read — most often "you're already
   * running another event". Swallowing the rejection made the button look inert on the web
   * while mobile explained itself.
   */
  async function runLifecycleAction(action: () => Promise<unknown>) {
    setLifecycleError(null);
    try {
      await action();
      queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch (err) {
      setLifecycleError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  const handlePublish = () => runLifecycleAction(() => activitiesApi.publish(activityId));
  const handleStart = () => runLifecycleAction(() => activitiesApi.start(activityId));

  async function handleEnd() {
    const confirmed = window.confirm(
      'End this event? Location sharing and location requests will stop for it. Attendance stays editable.',
    );
    if (!confirmed) return;
    await runLifecycleAction(() => activitiesApi.end(activityId));
  }

  async function handleSetRsvp(userId: string, status: 'approved' | 'declined') {
    setRsvpError(null);
    setSavingRsvpFor(userId);
    try {
      await rsvpsApi.setForMember(activityId, userId, status);
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'rsvps'] });
    } catch (err) {
      setRsvpError(err instanceof ApiError ? err.message : 'Failed to save that reply');
    } finally {
      setSavingRsvpFor(null);
    }
  }

  const activity = activityQuery.data?.activity;

  return (
    <PageContainer className="max-w-4xl">
      {groupId && (
        <Link to={`/groups/${groupId}`} className="text-sm text-blue-600 hover:underline">
          &larr; Back to group
        </Link>
      )}
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{activity?.title ?? '…'}</h1>

      {activity && (
        <Card className="mt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{formatActivityWhen(activity.startAt, activity.endAt, activity.allDay)}</span>
            {isLeader && activity.status !== 'completed' && !editingSchedule && (
              <button
                onClick={() => setEditingSchedule(true)}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Change
              </button>
            )}
            <span>&middot;</span>
            <span className="capitalize">{activity.transportMode}</span>
            <Badge status={activity.status} />
            {!activity.requiresRsvp && (
              <span className="inline-block whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                no RSVP required
              </span>
            )}
          </div>
          {editingSchedule && (
            <ActivityScheduleEditor activity={activity} onDone={() => setEditingSchedule(false)} />
          )}

          {activity.description && <p className="mt-3 text-sm text-slate-700">{activity.description}</p>}
          <a
            href={`${import.meta.env.VITE_API_BASE_URL}/api/activities/${activity.id}/ics`}
            className="mt-3 inline-block text-sm text-blue-600 hover:underline"
          >
            Download .ics
          </a>

          {isLeader && (
            <div className="mt-4 flex flex-wrap gap-2">
              {activity.status === 'draft' && (
                <Button onClick={handlePublish}>Publish &amp; notify members</Button>
              )}
              {activity.status === 'published' && (
                <Button onClick={handleStart}>Start event</Button>
              )}
              {(activity.status === 'published' || activity.status === 'in_progress') && (
                <Button variant="secondary" onClick={handleEnd}>
                  End event
                </Button>
              )}
              {activity.status === 'completed' && (
                <p className="text-sm text-slate-500">
                  This event has ended — location sharing is closed.
                </p>
              )}
            </div>
          )}
          {lifecycleError && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {lifecycleError}
            </p>
          )}
        </Card>
      )}

      {isLeader && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">RSVP dashboard</h2>
          {rsvpError && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{rsvpError}</p>
          )}
          {activity?.status === 'draft' ? (
            <p className="mt-2 text-sm text-slate-400">
              Publish this activity to start collecting RSVPs.
            </p>
          ) : (
            <Card className="mt-3 overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Note</th>
                    <th className="px-4 py-3">Reply for them</th>
                  </tr>
                </thead>
                <tbody>
                  {rsvpsQuery.data?.rsvps.map((rsvp) => (
                    <tr key={rsvp.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 text-slate-900">
                        {rsvp.user.name} <span className="text-slate-400">({rsvp.user.email})</span>
                        {rsvp.isVisitor && (
                          <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                            Visitor
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={rsvp.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{rsvp.note ?? '—'}</td>
                      <td className="px-4 py-3">
                        {/* Members often reply by phone days ahead — the leader records it here. */}
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant={rsvp.status === 'approved' ? 'primary' : 'secondary'}
                            disabled={savingRsvpFor === rsvp.userId || rsvp.status === 'approved'}
                            onClick={() => handleSetRsvp(rsvp.userId, 'approved')}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant={rsvp.status === 'declined' ? 'primary' : 'secondary'}
                            disabled={savingRsvpFor === rsvp.userId || rsvp.status === 'declined'}
                            onClick={() => handleSetRsvp(rsvp.userId, 'declined')}
                          >
                            Won&apos;t arrive
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rsvpsQuery.data?.rsvps.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                        No RSVPs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}

          {/* Visitors show up in the table above once invited; this is just how you add them. */}
          {activity?.status !== 'draft' && <ActivityVisitorsPanel activityId={activityId} />}
        </section>
      )}

      {/* The initial meeting point is planned here; further stops and the roll call are on mobile. */}
      {isLeader && <MeetingPointsPanel activityId={activityId} />}
    </PageContainer>
  );
}
