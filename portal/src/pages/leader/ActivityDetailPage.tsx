import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { rsvpsApi } from '../../api/rsvpsApi.js';
import { groupsApi } from '../../api/groupsApi.js';
import { LiveLocationDashboard } from '../../components/LiveLocationDashboard.js';
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
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      {groupId && <Link to={`/groups/${groupId}`}>&larr; Back to group</Link>}
      <h1>{activity?.title ?? '…'}</h1>
      {activity && (
        <>
          <p style={{ color: '#888' }}>
            {new Date(activity.startAt).toLocaleString()} · {activity.transportMode} ·{' '}
            <strong>{activity.status}</strong>
          </p>
          {activity.description && <p>{activity.description}</p>}
          <a href={`${import.meta.env.VITE_API_BASE_URL}/api/activities/${activity.id}/ics`}>
            Download .ics
          </a>

          {isLeader && activity.status === 'draft' && (
            <div style={{ marginTop: 16 }}>
              <button onClick={handlePublish}>Publish &amp; notify members</button>
            </div>
          )}
        </>
      )}

      {isLeader && (
        <>
          <h2>RSVP dashboard</h2>
          {activity?.status === 'draft' ? (
            <p style={{ color: '#888' }}>Publish this activity to start collecting RSVPs.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                  <th style={{ padding: 8 }}>Member</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {rsvpsQuery.data?.rsvps.map((rsvp) => (
                  <tr key={rsvp.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>
                      {rsvp.user.name} ({rsvp.user.email})
                    </td>
                    <td style={{ padding: 8 }}>{rsvp.status}</td>
                    <td style={{ padding: 8 }}>{rsvp.note ?? '—'}</td>
                  </tr>
                ))}
                {rsvpsQuery.data?.rsvps.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 8, color: '#888' }}>
                      No RSVPs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </>
      )}

      {isLeader && activity?.status !== 'draft' && rsvpsQuery.data && (
        <LiveLocationDashboard activityId={activityId} rsvps={rsvpsQuery.data.rsvps} />
      )}
    </div>
  );
}
