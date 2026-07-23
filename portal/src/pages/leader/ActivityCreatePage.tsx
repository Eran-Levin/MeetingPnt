import type { TransportMode } from '@meetingpnt/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { ApiError } from '../../api/client.js';

const TRANSPORT_MODES: TransportMode[] = ['driving', 'walking', 'bicycling', 'transit'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ActivityCreatePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('driving');
  const [repeats, setRepeats] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [endType, setEndType] = useState<'count' | 'until'>('count');
  const [count, setCount] = useState('8');
  const [until, setUntil] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (repeats && daysOfWeek.length === 0) {
      setError('Pick at least one day of the week to repeat on.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await activitiesApi.create(groupId!, {
        title,
        description: description || undefined,
        startAt: new Date(startAt).toISOString(),
        transportMode,
        recurrence: repeats
          ? {
              frequency: 'weekly',
              daysOfWeek,
              endType,
              count: endType === 'count' ? Number(count) : undefined,
              until: endType === 'until' ? new Date(until).toISOString() : undefined,
            }
          : undefined,
      });

      if ('activities' in result) {
        navigate(`/groups/${groupId}`);
      } else {
        navigate(`/activities/${result.activity.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create activity');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 500, margin: '0 auto' }}>
      <Link to={`/groups/${groupId}`}>&larr; Back to group</Link>
      <h1>New activity</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          />
        </label>
        <label>
          {repeats ? 'First occurrence date & time' : 'Date & time'}
          <input
            type="datetime-local"
            required
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          />
        </label>
        <label>
          Mode of transport
          <select
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value as TransportMode)}
            style={{ width: '100%', padding: 8 }}
          >
            {TRANSPORT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
          Repeat weekly
        </label>

        {repeats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {WEEKDAY_LABELS.map((label, day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 12,
                    border: '1px solid #ccc',
                    background: daysOfWeek.includes(day) ? '#2563eb' : 'white',
                    color: daysOfWeek.includes(day) ? 'white' : '#333',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="radio"
                checked={endType === 'count'}
                onChange={() => setEndType('count')}
              />
              For
              <input
                type="number"
                min={1}
                max={52}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                disabled={endType !== 'count'}
                style={{ width: 60, padding: 4 }}
              />
              occurrences
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" checked={endType === 'until'} onChange={() => setEndType('until')} />
              Until
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                disabled={endType !== 'until'}
                style={{ padding: 4 }}
              />
            </label>
          </div>
        )}

        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : repeats ? 'Create series (drafts)' : 'Create draft'}
        </button>
      </form>
    </div>
  );
}
