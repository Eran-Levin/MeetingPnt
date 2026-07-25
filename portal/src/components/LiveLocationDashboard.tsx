import type { LocationSnapshotWithUser, MeetingPoint, RsvpWithUser } from '@meetingpnt/shared';
import { SocketEvents } from '@meetingpnt/shared';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { locationsApi } from '../api/locationsApi.js';
import { meetingPointsApi } from '../api/meetingPointsApi.js';
import { getSocket } from '../lib/socket.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';

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
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">Meeting points</h2>

      <Card className="mt-3 divide-y divide-slate-100 p-0">
        {meetingPoints.map((mp) => (
          <div key={mp.id} className="flex items-center justify-between px-4 py-3">
            <span className={`text-sm ${mp.id === nextMeetingPoint?.id ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
              {mp.label || 'Meeting point'} — {new Date(mp.time).toLocaleString()}
              {mp.id === nextMeetingPoint?.id && (
                <span className="ml-2 text-blue-600">(current ETA target)</span>
              )}
            </span>
            <a
              href={mp.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Open in Maps
            </a>
          </div>
        ))}
        {meetingPoints.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No meeting points set yet.</p>
        )}
      </Card>

      <Card className="mt-3">
        <form onSubmit={handleAddMeetingPoint} className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            placeholder="Google Maps URL"
            value={googleMapsUrl}
            onChange={(e) => setGoogleMapsUrl(e.target.value)}
            required
            className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button type="submit" disabled={submitting} size="sm">
            {submitting ? 'Adding…' : 'Add meeting point'}
          </Button>
        </form>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </Card>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Live locations</h2>

      {apiKey && nextMeetingPoint && (
        <Card className="mt-3 overflow-hidden p-0">
          <div style={{ height: 320 }}>
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
        </Card>
      )}

      <Card className="mt-3 overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">ETA</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {approvedRsvps.map((rsvp) => {
              const loc = locations[rsvp.userId];
              return (
                <tr key={rsvp.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-900">{rsvp.user.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {loc?.etaSeconds != null
                      ? `${Math.round(loc.etaSeconds / 60)} min`
                      : loc
                        ? 'ETA unavailable'
                        : 'No update yet'}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => handleRequestLocation(rsvp.userId)}>
                      Request location
                    </Button>
                  </td>
                </tr>
              );
            })}
            {approvedRsvps.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  No approved attendees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
