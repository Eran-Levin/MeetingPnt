import type { GroupWithRole } from '@meetingpnt/shared';
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

  // "Closed" is a finished group; planned and in-progress are both still live concerns.
  const activeGroups = data?.groups.filter((g) => g.status !== 'completed') ?? [];
  const closedGroups = data?.groups.filter((g) => g.status === 'completed') ?? [];

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

      <GroupSection title="Active" groups={activeGroups} emptyLabel="No active groups." />
      {closedGroups.length > 0 && <GroupSection title="Closed" groups={closedGroups} />}

      {data?.groups.length === 0 && <p className="mt-6 text-sm text-slate-400">No groups yet.</p>}
    </PageContainer>
  );
}

function GroupSection({
  title,
  groups,
  emptyLabel,
}: {
  title: string;
  groups: GroupWithRole[];
  emptyLabel?: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
        {title} <span className="text-slate-300">({groups.length})</span>
      </h2>

      <ul className="mt-3 flex flex-col gap-3">
        {groups.map((group) => (
          <li key={group.id}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/groups/${group.id}`} className="font-semibold text-slate-900 hover:text-blue-600">
                  {group.name}
                </Link>
                <Badge status={group.status} />
                {!group.isLeader && <span className="text-sm text-slate-400">(member)</span>}
                <span className="ml-auto text-sm text-slate-500">
                  {group.nextActivityAt
                    ? `Next: ${new Date(group.nextActivityAt).toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`
                    : 'Nothing scheduled'}
                </span>
              </div>
              {group.description && <p className="mt-1 text-sm text-slate-500">{group.description}</p>}
            </Card>
          </li>
        ))}
        {groups.length === 0 && emptyLabel && (
          <p className="text-sm text-slate-400">{emptyLabel}</p>
        )}
      </ul>
    </section>
  );
}
