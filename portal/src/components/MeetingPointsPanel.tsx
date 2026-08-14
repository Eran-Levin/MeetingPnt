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
  /** One place, no route: the panel becomes a single meeting point with nothing to add to. */
  singleLocation: boolean;
}

/** Converts an ISO instant to the value a datetime-local input expects (local time, no zone). */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fieldClass =
  'rounded-lg border border-line-strong px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

/**
 * The leader plans the route here, in the order the group will walk it. During the event they
 * work down this list from their phone; stops they've reached are marked, and the plan can still
 * be edited ahead of the group.
 */
export function MeetingPointsPanel({ activityId, currentMeetingPointId, singleLocation }: Props) {
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
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">
          {singleLocation ? 'Meeting point' : 'Itinerary'}
        </h2>
        {/* A single-location event has one place and no route, so once it's set there is nothing
            to add. Everything else can gain a stop at any time. */}
        {editing === null && !(singleLocation && meetingPoints.length > 0) && (
          <Button variant="secondary" size="sm" onClick={startAdding}>
            {singleLocation || meetingPoints.length === 0 ? 'Add meeting point' : 'Add stop'}
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-secondary">
        {singleLocation
          ? 'Where the class meets. The same place every time — there is no route to walk.'
          : 'The stops in the order the group will walk them. During the activity you move between them from your phone, and can still add stops the group hasn’t reached.'}
      </p>

      {listError && (
        <p className="mt-2 rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">{listError}</p>
      )}

      {meetingPoints.length > 0 && (
        <Card className="mt-3 divide-y divide-line p-0">
          {meetingPoints.map((point, index) => {
            const isCurrent = point.id === currentMeetingPointId;
            const reached = point.arrivedAt !== null;
            return (
              <div key={point.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm">
                    {/* The number is a position in a route. With one place there's no route, so
                        it would only ever say "1". */}
                    {!singleLocation && (
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          isCurrent
                            ? 'bg-accent text-white'
                            : reached
                              ? 'bg-surface-raised text-ink-secondary'
                              : 'bg-surface text-ink-muted ring-1 ring-line-strong'
                        }`}
                      >
                        {index + 1}
                      </span>
                    )}
                    <span>
                      <span className="text-ink">{point.label || 'Meeting point'}</span>{' '}
                      <span className="text-ink-muted">
                        {new Date(point.time).toLocaleString()}
                      </span>
                      {isCurrent && (
                        <span className="ml-2 rounded-full bg-tone-accent-bg px-2 py-0.5 text-xs font-medium text-tone-accent-fg">
                          Group is here
                        </span>
                      )}
                      {reached && !isCurrent && (
                        <span className="ml-2 text-xs text-ink-muted">visited</span>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <a
                      href={point.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-accent-text hover:underline"
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
          <p className="text-sm text-ink-muted">
            {singleLocation
              ? 'No meeting point yet — add where the class meets.'
              : 'No stops planned yet — add where the group first gathers.'}
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
            submitLabel={singleLocation || meetingPoints.length === 0 ? 'Add meeting point' : 'Add stop'}
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

/**
 * Stacked rather than one wrapping row: the itinerary now sits in a column beside the replies,
 * and three inputs side by side in that width left the Maps URL — the long one — narrowest.
 */
function MeetingPointForm(props: FormProps) {
  return (
    <div className="bg-surface-sunken px-4 py-3">
      <form onSubmit={props.onSubmit} className="flex flex-col gap-2">
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
          className={fieldClass}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={props.time}
            onChange={(e) => props.setTime(e.target.value)}
            required
            className={`flex-1 ${fieldClass}`}
          />
          <Button type="submit" disabled={props.submitting} size="sm">
            {props.submitting ? 'Saving…' : props.submitLabel}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={props.onCancel}>
            Cancel
          </Button>
        </div>
      </form>
      {props.error && <p className="mt-2 text-sm text-tone-danger-fg">{props.error}</p>}
    </div>
  );
}
