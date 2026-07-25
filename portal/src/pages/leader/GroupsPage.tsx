import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi } from '../../api/groupsApi.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { TextField } from '../../components/ui/TextField.js';

export function GroupsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

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
    <PageContainer>
      <h1 className="text-2xl font-semibold text-slate-900">Groups</h1>
      <p className="mt-1 text-sm text-slate-500">Groups you lead or belong to.</p>

      <Card className="mt-6">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <TextField
            label="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-[160px] flex-1"
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-w-[200px] flex-[2]"
          />
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create group'}
          </Button>
        </form>
      </Card>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}

      <ul className="mt-6 flex flex-col gap-3">
        {data?.groups.map((group) => (
          <li key={group.id}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="flex items-center gap-2">
                <Link to={`/groups/${group.id}`} className="font-semibold text-slate-900 hover:text-blue-600">
                  {group.name}
                </Link>
                <Badge status={group.status} />
                {!group.isLeader && <span className="text-sm text-slate-400">(member)</span>}
              </div>
              {group.description && <p className="mt-1 text-sm text-slate-500">{group.description}</p>}
            </Card>
          </li>
        ))}
        {data?.groups.length === 0 && (
          <p className="text-sm text-slate-400">No groups yet.</p>
        )}
      </ul>
    </PageContainer>
  );
}
