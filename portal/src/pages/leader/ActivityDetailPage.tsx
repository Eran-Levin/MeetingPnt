import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { rsvpsApi } from '../../api/rsvpsApi.js';
import { groupsApi } from '../../api/groupsApi.js';
import { ActivityVisitorsPanel } from '../../components/ActivityVisitorsPanel.js';
import { AttendancePanel } from '../../components/AttendancePanel.js';
import { LiveLocationDashboard } from '../../components/LiveLocationDashboard.js';
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

  async function handlePublish() {
    await activitiesApi.publish(activityId);
    queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
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
            <span>
              {new Date(activity.startAt).toLocaleString()}
              {activity.endAt && <> &rarr; {new Date(activity.endAt).toLocaleString()}</>}
            </span>
            <span>&middot;</span>
            <span className="capitalize">{activity.transportMode}</span>
            <Badge status={activity.status} />
            {!activity.requiresRsvp && (
              <span className="inline-block whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                no RSVP required
              </span>
            )}
          </div>
          {activity.description && <p className="mt-3 text-sm text-slate-700">{activity.description}</p>}
          <a
            href={`${import.meta.env.VITE_API_BASE_URL}/api/activities/${activity.id}/ics`}
            className="mt-3 inline-block text-sm text-blue-600 hover:underline"
          >
            Download .ics
          </a>

          {isLeader && activity.status === 'draft' && (
            <div className="mt-4">
              <Button onClick={handlePublish}>Publish &amp; notify members</Button>
            </div>
          )}
        </Card>
      )}

      {isLeader && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">RSVP dashboard</h2>
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
                  </tr>
                </thead>
                <tbody>
                  {rsvpsQuery.data?.rsvps.map((rsvp) => (
                    <tr key={rsvp.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 text-slate-900">
                        {rsvp.user.name} <span className="text-slate-400">({rsvp.user.email})</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={rsvp.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{rsvp.note ?? '—'}</td>
                    </tr>
                  ))}
                  {rsvpsQuery.data?.rsvps.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                        No RSVPs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      )}

      {isLeader && activity?.status !== 'draft' && rsvpsQuery.data && (
        <LiveLocationDashboard activityId={activityId} rsvps={rsvpsQuery.data.rsvps} />
      )}

      {isLeader && activity?.status !== 'draft' && rsvpsQuery.data && (
        <AttendancePanel
          activityId={activityId}
          approvedRsvps={rsvpsQuery.data.rsvps.filter((rsvp) => rsvp.status === 'approved')}
        />
      )}

      {isLeader && <ActivityVisitorsPanel activityId={activityId} />}
    </PageContainer>
  );
}
