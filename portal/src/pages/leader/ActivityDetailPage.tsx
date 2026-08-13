import { formatActivityWhen } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { ApiError } from '../../api/client.js';
import { groupsApi } from '../../api/groupsApi.js';
import { rsvpsApi } from '../../api/rsvpsApi.js';
import { ActivityEditor } from '../../components/ActivityEditor.js';
import { ActivityVisitorsPanel } from '../../components/ActivityVisitorsPanel.js';
import { AttendancePanel } from '../../components/AttendancePanel.js';
import { MeetingPointsPanel } from '../../components/MeetingPointsPanel.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
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
  /**
   * A trip day takes no replies, so the right-hand column has nothing in it — and an itinerary
   * pinned to three fifths of the page with empty space beside it looks like something failed to
   * load. One column when there's one thing.
   */
  const showAttendance = isLeader && activity?.requiresRsvp;

  if (!activity) {
    return (
      <PageContainer wide>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-8 w-2/5" />
        <Skeleton className="mt-3 h-4 w-1/3" />
      </PageContainer>
    );
  }

  return (
    <PageContainer wide>
      {groupId && (
        <Link to={`/groups/${groupId}`} className="text-sm text-accent-text hover:underline">
          &larr; Back to group
        </Link>
      )}

      {/* Everything about the event itself, and every action that changes its state, in one band
          at the top — the leader shouldn't have to hunt for "publish" among the planning tools. */}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink">{activity.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
            <span>{formatActivityWhen(activity.startAt, activity.endAt, activity.allDay)}</span>
            <span>&middot;</span>
            <span className="capitalize">{activity.transportMode}</span>
            <Badge status={activity.status} />
            {!activity.requiresRsvp && (
              <span className="inline-block whitespace-nowrap rounded-full bg-tone-warning-bg px-2.5 py-0.5 text-xs font-medium text-tone-warning-fg">
                attendance not approved
              </span>
            )}
          </div>
        </div>

        {isLeader && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {activity.status !== 'completed' && !editingSchedule && (
              <Button variant="secondary" size="sm" onClick={() => setEditingSchedule(true)}>
                Edit event
              </Button>
            )}
            {activity.status === 'draft' && (
              <Button size="sm" onClick={handlePublish}>
                Publish &amp; notify members
              </Button>
            )}
            {activity.status === 'published' && (
              <Button size="sm" onClick={handleStart}>
                Start event
              </Button>
            )}
            {(activity.status === 'published' || activity.status === 'in_progress') && (
              <Button variant="secondary" size="sm" onClick={handleEnd}>
                End event
              </Button>
            )}
          </div>
        )}
      </div>

      {activity.status === 'completed' && (
        <p className="mt-3 text-sm text-ink-secondary">
          This event has ended — location sharing is closed.
        </p>
      )}
      {lifecycleError && (
        <p className="mt-3 rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">
          {lifecycleError}
        </p>
      )}

      {editingSchedule && (
        <Card className="mt-4">
          <ActivityEditor activity={activity} onDone={() => setEditingSchedule(false)} />
        </Card>
      )}

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink">{activity.description}</p>
        <a
          href={`${import.meta.env.VITE_API_BASE_URL}/api/activities/${activity.id}/ics`}
          className="text-sm text-accent-text hover:underline"
        >
          Download .ics
        </a>
      </div>

      {/* The route is the thing being built here, so it leads and takes the wider column; walking
          it and the roll call happen on the leader's phone. Replies sit alongside rather than
          below, because deciding the route and watching who's coming are the same sitting. */}
      <div
        className={`mt-8 grid items-start gap-8 ${
          showAttendance ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''
        }`}
      >
        {isLeader && (
          <MeetingPointsPanel
            activityId={activityId}
            currentMeetingPointId={activity.currentMeetingPointId}
            singleLocation={activity.singleLocation}
          />
        )}

        {/* Nothing to chase when attendance isn't approved: everyone is already counted as coming,
            so the dashboard would be a wall of identical rows. Inviting a visitor goes with it —
            on a trip day the roster is the manifest, not something you top up. Marking someone as
            not coming still works from the roll call on the leader's phone. */}
        {showAttendance && (
          <section>
            <h2 className="text-lg font-semibold text-ink">Who&rsquo;s coming</h2>
            {activity.status === 'draft' ? (
              <p className="mt-2 text-sm text-ink-muted">
                Publish this event to start collecting replies.
              </p>
            ) : (
              <>
                <AttendancePanel
                  rsvps={rsvpsQuery.data?.rsvps ?? []}
                  loading={rsvpsQuery.isLoading}
                  savingFor={savingRsvpFor}
                  error={rsvpError}
                  onSet={handleSetRsvp}
                />
                {/* Visitors show up in the list above once invited; this is how you add them. */}
                <ActivityVisitorsPanel activityId={activityId} />
              </>
            )}
          </section>
        )}
      </div>
    </PageContainer>
  );
}
