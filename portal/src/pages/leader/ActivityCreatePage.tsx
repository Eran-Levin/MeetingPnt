import type { TransportMode } from '@meetingpnt/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { ApiError } from '../../api/client.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { Select } from '../../components/ui/Select.js';
import { TextArea, TextField } from '../../components/ui/TextField.js';

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
    <PageContainer>
      <Link to={`/groups/${groupId}`} className="text-sm text-blue-600 hover:underline">
        &larr; Back to group
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">New activity</h1>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextArea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <TextField
            label={repeats ? 'First occurrence date & time' : 'Date & time'}
            type="datetime-local"
            required
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
          <Select
            label="Mode of transport"
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value as TransportMode)}
          >
            {TRANSPORT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </Select>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={repeats}
              onChange={(e) => setRepeats(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Repeat weekly
          </label>

          {repeats && (
            <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-4">
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, day) => (
                  <button
                    type="button"
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                      daysOfWeek.includes(day)
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={endType === 'count'}
                  onChange={() => setEndType('count')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                For
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  disabled={endType !== 'count'}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                />
                occurrences
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={endType === 'until'}
                  onChange={() => setEndType('until')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                Until
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  disabled={endType !== 'until'}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : repeats ? 'Create series (drafts)' : 'Create draft'}
          </Button>
        </form>
      </Card>
    </PageContainer>
  );
}
