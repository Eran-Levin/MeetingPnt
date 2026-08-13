import type { GroupWithRole } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi } from '../../api/groupsApi.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { EmptyState, SkeletonRows } from '../../components/ui/Skeleton.js';
import { TextField } from '../../components/ui/TextField.js';

export function GroupsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [composing, setComposing] = useState(false);

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
      setComposing(false);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageContainer wide>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Groups</h1>
          <p className="mt-1 text-sm text-ink-secondary">Groups you lead or belong to.</p>
        </div>
        {!composing && <Button onClick={() => setComposing(true)}>New group</Button>}
      </div>

      {composing && (
        <Card className="mt-6">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <TextField
              label="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
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
            <Button type="button" variant="secondary" onClick={() => setComposing(false)}>
              Cancel
            </Button>
          </form>
        </Card>
      )}

      {isLoading && (
        <div className="mt-8">
          <SkeletonRows rows={3} />
        </div>
      )}

      {!isLoading && data?.groups.length === 0 && (
        <div className="mt-8">
          <EmptyState
            headline="Start your first group"
            body="A group holds a roster and the events that run inside it — a yoga term, a photo club, one trip departure."
            action={<Button onClick={() => setComposing(true)}>New group</Button>}
          />
        </div>
      )}

      {activeGroups.length > 0 && <GroupSection title="Active" groups={activeGroups} />}
      {closedGroups.length > 0 && <GroupSection title="Closed" groups={closedGroups} />}
    </PageContainer>
  );
}

function GroupSection({ title, groups }: { title: string; groups: GroupWithRole[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {title} <span className="text-line-strong">({groups.length})</span>
      </h2>

      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <li key={group.id}>
            <Link to={`/groups/${group.id}`} className="block h-full">
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{group.name}</span>
                  <Badge status={group.status} />
                  {!group.isLeader && <span className="text-sm text-ink-muted">(member)</span>}
                </div>
                {group.description && (
                  <p className="mt-1 text-sm text-ink-secondary">{group.description}</p>
                )}
                <p className="mt-3 text-sm text-ink-secondary">
                  {group.nextActivityAt
                    ? `Next: ${new Date(group.nextActivityAt).toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`
                    : 'Nothing scheduled'}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
