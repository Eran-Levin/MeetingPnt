import type { LocationSnapshotWithUser, RsvpWithUser } from '@meetingpnt/shared';
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

export function LiveLocationDashboard({ activityId, rsvps }: Props) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locations, setLocations] = useState<Record<string, LocationSnapshotWithUser>>({});

  const meetingPointsQuery = useQuery({
    queryKey: ['activities', activityId, 'meeting-points'],
    queryFn: () => meetingPointsApi.list(activityId),
  });
  const primaryMeetingPoint = meetingPointsQuery.data?.meetingPoints.find((m) => m.isPrimary);

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

  async function handleSetMeetingPoint(e: React.FormEvent) {
    e.preventDefault();
    await meetingPointsApi.create(activityId, {
      label: label || undefined,
      location: { lat: Number(lat), lng: Number(lng) },
    });
    queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'meeting-points'] });
  }

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(String(pos.coords.latitude));
      setLng(String(pos.coords.longitude));
    });
  }

  async function handleRequestLocation(userId: string) {
    await locationsApi.requestPing(activityId, userId);
  }

  const approvedRsvps = rsvps.filter((r) => r.status === 'approved');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Live locations</h2>

      {!primaryMeetingPoint ? (
        <form
          onSubmit={handleSetMeetingPoint}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ padding: 8 }}
          />
          <input
            placeholder="Latitude"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            required
            style={{ padding: 8, width: 120 }}
          />
          <input
            placeholder="Longitude"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            required
            style={{ padding: 8, width: 120 }}
          />
          <button type="button" onClick={useMyLocation}>
            Use my location
          </button>
          <button type="submit">Set meeting point</button>
        </form>
      ) : (
        <>
          {apiKey && (
            <div style={{ height: 320, marginBottom: 16 }}>
              <APIProvider apiKey={apiKey}>
                <Map
                  defaultCenter={primaryMeetingPoint.location}
                  defaultZoom={13}
                  gestureHandling="greedy"
                >
                  <Marker position={primaryMeetingPoint.location} label="M" title="Meeting point" />
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
        </>
      )}
    </div>
  );
}
