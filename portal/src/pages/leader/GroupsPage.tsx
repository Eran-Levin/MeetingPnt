import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi } from '../../api/groupsApi.js';
import { authApi } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';

export function GroupsPage() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  async function handleLogout() {
    await authApi.logout();
    clearSession();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await groupsApi.create({ name, description: description || undefined });
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Groups</h1>
        <button onClick={handleLogout}>Log out</button>
      </div>

      <form
        onSubmit={handleCreate}
        style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}
      >
        <input
          placeholder="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 8, flex: 1, minWidth: 160 }}
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ padding: 8, flex: 2, minWidth: 200 }}
        />
        <button type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create group'}
        </button>
      </form>

      {isLoading && <p>Loading…</p>}

      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data?.groups.map((group) => (
          <li key={group.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <Link to={`/groups/${group.id}`} style={{ fontWeight: 600 }}>
              {group.name}
            </Link>
            {!group.isLeader && <span style={{ color: '#888', marginLeft: 8 }}>(member)</span>}
            {group.description && <p style={{ margin: '4px 0 0', color: '#555' }}>{group.description}</p>}
          </li>
        ))}
        {data?.groups.length === 0 && <p style={{ color: '#888' }}>No groups yet.</p>}
      </ul>
    </div>
  );
}
