import type { TransportMode } from '@meetingpnt/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { ApiError } from '../../api/client.js';

const TRANSPORT_MODES: TransportMode[] = ['driving', 'walking', 'bicycling', 'transit'];

export function ActivityCreatePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('driving');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { activity } = await activitiesApi.create(groupId!, {
        title,
        description: description || undefined,
        startAt: new Date(startAt).toISOString(),
        transportMode,
      });
      navigate(`/activities/${activity.id}`);
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
          Date &amp; time
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
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create draft'}
        </button>
      </form>
    </div>
  );
}
