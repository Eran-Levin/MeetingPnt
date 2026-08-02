import type { MeetingPoint } from '@meetingpnt/shared';
import { SocketEvents } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { meetingPointsApi } from '../api/meetingPointsApi.js';
import { ApiError } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';

interface Props {
  activityId: string;
  currentMeetingPointId: string | null;
}

/** Converts an ISO instant to the value a datetime-local input expects (local time, no zone). */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fieldClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

/**
 * The leader plans the route here, in the order the group will walk it. During the event they
 * work down this list from their phone; stops they've reached are marked, and the plan can still
 * be edited ahead of the group.
 */
export function MeetingPointsPanel({ activityId, currentMeetingPointId }: Props) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [time, setTime] = useState('');
  /** null = not editing, 'new' = adding a stop, otherwise the id of the stop being changed. */
  const [editing, setEditing] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const meetingPointsQuery = useQuery({
    queryKey: ['activities', activityId, 'meeting-points'],
    queryFn: () => meetingPointsApi.list(activityId),
  });

  const meetingPoints = meetingPointsQuery.data?.meetingPoints ?? [];

  // The leader moves the group from their phone; keep the plan in step as they do.
  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.emit('activity:join', activityId);

    function onMeetingPointCreated() {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'meeting-points'] });
      queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
    }

    socket.on(SocketEvents.MeetingPointCreated, onMeetingPointCreated);
    return () => {
      socket.off(SocketEvents.MeetingPointCreated, onMeetingPointCreated);
      socket.disconnect();
    };
  }, [activityId, queryClient]);

  function startAdding() {
    setLabel('');
    setGoogleMapsUrl('');
    setTime('');
    setFormError(null);
    setEditing('new');
  }

  function startEditing(point: MeetingPoint) {
    setLabel(point.label ?? '');
    setGoogleMapsUrl(point.googleMapsUrl);
    setTime(toLocalInputValue(point.time));
    setFormError(null);
    setEditing(point.id);
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
      if (editing === 'new') await meetingPointsApi.create(activityId, dto);
      else if (editing) await meetingPointsApi.update(editing, dto);

      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'meeting-points'] });
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Couldn't read coordinates from that link — try a full (non-shortened) Google Maps URL.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(point: MeetingPoint) {
    const confirmed = window.confirm(
      `Remove "${point.label || 'this stop'}" from the plan?`,
    );
    if (!confirmed) return;
    setListError(null);
    try {
      await meetingPointsApi.remove(point.id);
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'meeting-points'] });
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Failed to remove that stop');
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Itinerary</h2>
        {editing === null && (
          <Button variant="secondary" size="sm" onClick={startAdding}>
            + Add stop
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        The stops in the order the group will walk them. During the event you move between them
        from your phone, and can still add stops the group hasn&rsquo;t reached.
      </p>

      {listError && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{listError}</p>
      )}

      {meetingPoints.length > 0 && (
        <Card className="mt-3 divide-y divide-slate-100 p-0">
          {meetingPoints.map((point, index) => {
            const isCurrent = point.id === currentMeetingPointId;
            const reached = point.arrivedAt !== null;
            return (
              <div key={point.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : reached
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-white text-slate-400 ring-1 ring-slate-300'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span>
                      <span className="text-slate-900">{point.label || 'Meeting point'}</span>{' '}
                      <span className="text-slate-400">
                        {new Date(point.time).toLocaleString()}
                      </span>
                      {isCurrent && (
                        <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Group is here
                        </span>
                      )}
                      {reached && !isCurrent && (
                        <span className="ml-2 text-xs text-slate-400">visited</span>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <a
                      href={point.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Open in Maps
                    </a>
                    {editing === null && (
                      <Button variant="secondary" size="sm" onClick={() => startEditing(point)}>
                        Change
                      </Button>
                    )}
                    {/* A visited stop is part of the record of where the group went. */}
                    {editing === null && !reached && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(point)}>
                        Remove
                      </Button>
                    )}
                  </span>
                </div>
                {editing === point.id && (
                  <MeetingPointForm
                    label={label}
                    setLabel={setLabel}
                    googleMapsUrl={googleMapsUrl}
                    setGoogleMapsUrl={setGoogleMapsUrl}
                    time={time}
                    setTime={setTime}
                    submitting={submitting}
                    submitLabel="Save"
                    error={formError}
                    onSubmit={handleSubmit}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </div>
            );
          })}
        </Card>
      )}

      {meetingPoints.length === 0 && editing === null && (
        <Card className="mt-3">
          <p className="text-sm text-slate-400">
            No stops planned yet — add where the group first gathers.
          </p>
        </Card>
      )}

      {editing === 'new' && (
        <Card className="mt-3">
          <MeetingPointForm
            label={label}
            setLabel={setLabel}
            googleMapsUrl={googleMapsUrl}
            setGoogleMapsUrl={setGoogleMapsUrl}
            time={time}
            setTime={setTime}
            submitting={submitting}
            submitLabel="Add stop"
            error={formError}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}
    </section>
  );
}

interface FormProps {
  label: string;
  setLabel: (v: string) => void;
  googleMapsUrl: string;
  setGoogleMapsUrl: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  submitting: boolean;
  submitLabel: string;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function MeetingPointForm(props: FormProps) {
  return (
    <div className="bg-slate-50 px-4 py-3">
      <form onSubmit={props.onSubmit} className="flex flex-wrap items-center gap-2">
        <input
          placeholder="Label (optional)"
          value={props.label}
          onChange={(e) => props.setLabel(e.target.value)}
          className={fieldClass}
        />
        <input
          placeholder="Google Maps URL"
          value={props.googleMapsUrl}
          onChange={(e) => props.setGoogleMapsUrl(e.target.value)}
          required
          className={`min-w-[220px] flex-1 ${fieldClass}`}
        />
        <input
          type="datetime-local"
          value={props.time}
          onChange={(e) => props.setTime(e.target.value)}
          required
          className={fieldClass}
        />
        <Button type="submit" disabled={props.submitting} size="sm">
          {props.submitting ? 'Saving…' : props.submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={props.onCancel}>
          Cancel
        </Button>
      </form>
      {props.error && <p className="mt-2 text-sm text-red-600">{props.error}</p>}
    </div>
  );
}
