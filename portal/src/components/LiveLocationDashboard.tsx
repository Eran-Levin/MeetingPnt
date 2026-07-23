import type { LocationSnapshotWithUser, MeetingPoint, RsvpWithUser } from '@meetingpnt/shared';
import { SocketEvents } from '@meetingpnt/shared';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { locationsApi } from '../api/locationsApi.js';
import { meetingPointsApi } from '../api/meetingPointsApi.js';
import { getSocket } from '../lib/socket.js';

interface Props {
  activityId: string;
  rsvps: RsvpWithUser[];
}

/** Whichever meeting point's time is soonest and hasn't passed yet — mirrors the backend's
 * OMW/ping ETA target selection so the UI highlight always matches what's actually computed. */
function getNextUpcoming(meetingPoints: MeetingPoint[]): MeetingPoint | undefined {
  const now = Date.now();
  const upcoming = meetingPoints
    .filter((m) => new Date(m.time).getTime() >= now)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  if (upcoming[0]) return upcoming[0];
  return [...meetingPoints].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0];
}

export function LiveLocationDashboard({ activityId, rsvps }: Props) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [time, setTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locations, setLocations] = useState<Record<string, LocationSnapshotWithUser>>({});

  const meetingPointsQuery = useQuery({
    queryKey: ['activities', activityId, 'meeting-points'],
    queryFn: () => meetingPointsApi.list(activityId),
  });
  const meetingPoints = meetingPointsQuery.data?.meetingPoints ?? [];
  const nextMeetingPoint = getNextUpcoming(meetingPoints);

  const latestQuery = useQuery({
    queryKey: ['activities', activityId, 'locations'],
    queryFn: () => locationsApi.latest(activityId),
  });

  useEffect(() => {
    if (!latestQuery.data) return;
    const next: Record<string, LocationSnapshotWithUser> = {};
    for (const loc of latestQuery.data.locations) next[loc.userId] = loc;
    setLocations(next);
  }, [latestQuery.data]);

  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.emit('activity:join', activityId);

    function onLocationUpdated(payload: { snapshot: LocationSnapshotWithUser }) {
      setLocations((prev) => ({ ...prev, [payload.snapshot.userId]: payload.snapshot }));
    }
    function onMeetingPointCreated() {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'meeting-points'] });
    }

    socket.on(SocketEvents.LocationUpdated, onLocationUpdated);
    socket.on(SocketEvents.MeetingPointCreated, onMeetingPointCreated);

    return () => {
      socket.off(SocketEvents.LocationUpdated, onLocationUpdated);
      socket.off(SocketEvents.MeetingPointCreated, onMeetingPointCreated);
      socket.disconnect();
    };
  }, [activityId, queryClient]);

  async function handleAddMeetingPoint(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await meetingPointsApi.create(activityId, {
        label: label || undefined,
        googleMapsUrl,
        time: new Date(time).toISOString(),
      });
      setLabel('');
      setGoogleMapsUrl('');
      setTime('');
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'meeting-points'] });
    } catch {
      setFormError("Couldn't read coordinates from that link — try a full (non-shortened) Google Maps URL.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestLocation(userId: string) {
    await locationsApi.requestPing(activityId, userId);
  }

  const approvedRsvps = rsvps.filter((r) => r.status === 'approved');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Meeting points</h2>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {meetingPoints.map((mp) => (
          <li
            key={mp.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: '1px solid #eee',
              fontWeight: mp.id === nextMeetingPoint?.id ? 600 : 400,
            }}
          >
            <span>
              {mp.label || 'Meeting point'} — {new Date(mp.time).toLocaleString()}
              {mp.id === nextMeetingPoint?.id && (
                <span style={{ color: '#2563eb', marginLeft: 8 }}>(current ETA target)</span>
              )}
            </span>
            <a href={mp.googleMapsUrl} target="_blank" rel="noreferrer">
              Open in Maps
            </a>
          </li>
        ))}
        {meetingPoints.length === 0 && <p style={{ color: '#888' }}>No meeting points set yet.</p>}
      </ul>

      <form
        onSubmit={handleAddMeetingPoint}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}
      >
        <input
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ padding: 8 }}
        />
        <input
          placeholder="Google Maps URL"
          value={googleMapsUrl}
          onChange={(e) => setGoogleMapsUrl(e.target.value)}
          required
          style={{ padding: 8, flex: 1, minWidth: 220 }}
        />
        <input
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
          style={{ padding: 8 }}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add meeting point'}
        </button>
      </form>
      {formError && <p style={{ color: 'crimson' }}>{formError}</p>}

      <h2 style={{ marginTop: 24 }}>Live locations</h2>

      {apiKey && nextMeetingPoint && (
        <div style={{ height: 320, marginBottom: 16 }}>
          <APIProvider apiKey={apiKey}>
            <Map defaultCenter={nextMeetingPoint.location} defaultZoom={13} gestureHandling="greedy">
              {meetingPoints.map((mp) => (
                <Marker
                  key={mp.id}
                  position={mp.location}
                  label="M"
                  title={mp.label ?? new Date(mp.time).toLocaleString()}
                />
              ))}
              {Object.values(locations).map((loc) => (
                <Marker
                  key={loc.userId}
                  position={loc.location}
                  label={loc.user?.name?.[0] ?? '?'}
                  title={loc.user?.name}
                />
              ))}
            </Map>
          </APIProvider>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
            <th style={{ padding: 8 }}>Member</th>
            <th style={{ padding: 8 }}>ETA</th>
            <th style={{ padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {approvedRsvps.map((rsvp) => {
            const loc = locations[rsvp.userId];
            return (
              <tr key={rsvp.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{rsvp.user.name}</td>
                <td style={{ padding: 8 }}>
                  {loc?.etaSeconds != null
                    ? `${Math.round(loc.etaSeconds / 60)} min`
                    : loc
                      ? 'ETA unavailable'
                      : 'No update yet'}
                </td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => handleRequestLocation(rsvp.userId)}>Request location</button>
                </td>
              </tr>
            );
          })}
          {approvedRsvps.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: 8, color: '#888' }}>
                No approved attendees yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
