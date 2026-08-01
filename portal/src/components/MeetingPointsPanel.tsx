import { SocketEvents } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { meetingPointsApi } from '../api/meetingPointsApi.js';
import { getSocket } from '../lib/socket.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';

interface Props {
  activityId: string;
}

/** Converts an ISO instant to the value a datetime-local input expects (local time, no zone). */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The Web sets the one *initial* meeting point during planning. Any further points are added
 * from the leader's phone as the group moves, so they appear here read-only for context.
 */
export function MeetingPointsPanel({ activityId }: Props) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [time, setTime] = useState('');
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const meetingPointsQuery = useQuery({
    queryKey: ['activities', activityId, 'meeting-points'],
    queryFn: () => meetingPointsApi.list(activityId),
  });

  const meetingPoints = meetingPointsQuery.data?.meetingPoints ?? [];
  const initialPoint = meetingPoints[0];
  const addedLater = meetingPoints.slice(1);

  // A leader may add points from their phone mid-event; keep this list in step.
  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.emit('activity:join', activityId);

    function onMeetingPointCreated() {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'meeting-points'] });
    }

    socket.on(SocketEvents.MeetingPointCreated, onMeetingPointCreated);
    return () => {
      socket.off(SocketEvents.MeetingPointCreated, onMeetingPointCreated);
      socket.disconnect();
    };
  }, [activityId, queryClient]);

  function startEditing() {
    if (!initialPoint) return;
    setLabel(initialPoint.label ?? '');
    setGoogleMapsUrl(initialPoint.googleMapsUrl);
    setTime(toLocalInputValue(initialPoint.time));
    setFormError(null);
    setEditing(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const dto = {
        label: label || undefined,
        googleMapsUrl,
        time: new Date(time).toISOString(),
      };
      if (initialPoint) await meetingPointsApi.update(initialPoint.id, dto);
      else await meetingPointsApi.create(activityId, dto);

      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'meeting-points'] });
    } catch {
      setFormError("Couldn't read coordinates from that link — try a full (non-shortened) Google Maps URL.");
    } finally {
      setSubmitting(false);
    }
  }

  const showForm = !initialPoint || editing;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">Meeting point</h2>
      <p className="mt-1 text-sm text-slate-500">
        Where the group first gathers. Further stops are added from your phone during the event.
      </p>

      {initialPoint && !editing && (
        <Card className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-slate-900">
            {initialPoint.label || 'Meeting point'}{' '}
            <span className="text-slate-400">{new Date(initialPoint.time).toLocaleString()}</span>
          </span>
          <span className="flex items-center gap-3">
            <a
              href={initialPoint.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Open in Maps
            </a>
            <Button variant="secondary" size="sm" onClick={startEditing}>
              Change
            </Button>
          </span>
        </Card>
      )}

      {showForm && (
        <Card className="mt-3">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
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
              {submitting ? 'Saving…' : initialPoint ? 'Save' : 'Set meeting point'}
            </Button>
            {editing && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </form>
          {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
        </Card>
      )}

      {addedLater.length > 0 && (
        <Card className="mt-3 divide-y divide-slate-100 p-0">
          <p className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Added during the event
          </p>
          {addedLater.map((mp) => (
            <div key={mp.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-700">
                {mp.label || 'Meeting point'}{' '}
                <span className="text-slate-400">{new Date(mp.time).toLocaleString()}</span>
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
        </Card>
      )}
    </section>
  );
}
