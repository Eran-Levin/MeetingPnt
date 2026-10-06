import type { GroupWithRole } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi } from '../../api/groupsApi.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { EmptyState, SkeletonRows } from '../../components/ui/Skeleton.js';
import { TextField } from '../../components/ui/TextField.js';
import { useLocale, useTranslation } from '../../i18n/index.js';

export function GroupsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [composing, setComposing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  /**
   * Only groups this leader runs. A leader who is also on someone else's roster reads that group
   * from the mobile app like any other member — the portal is the planning tool, and a read-only
   * roster has nothing to plan.
   */
  const myGroups = data?.groups.filter((g) => g.isLeader) ?? [];

  /**
   * A group is open or it's closed, and closing it is the only call the leader makes — for a
   * guide it's the end of the trip. `planned` and `in_progress` are both simply open, so the
   * distinction never reaches the screen.
   */
  const activeGroups = myGroups.filter((g) => g.status !== 'completed');
  const closedGroups = myGroups.filter((g) => g.status === 'completed');

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
          <h1 className="text-2xl font-semibold text-ink">{t('tabs.groups')}</h1>
          <p className="mt-1 text-sm text-ink-secondary">{t('groupsPage.subtitle')}</p>
        </div>
        {!composing && <Button onClick={() => setComposing(true)}>{t('groups.newGroup')}</Button>}
      </div>

      {composing && (
        <Card className="mt-6">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <TextField
              label={t('groups.groupName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="min-w-[160px] flex-1"
            />
            <TextField
              label={t('newActivity.description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-w-[200px] flex-[2]"
            />
            <Button type="submit" disabled={creating}>
              {creating ? t('groups.creating') : t('groups.createGroup')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setComposing(false)}>
              {t('common.cancel')}
            </Button>
          </form>
        </Card>
      )}

      {isLoading && (
        <div className="mt-8">
          <SkeletonRows rows={3} />
        </div>
      )}

      {!isLoading && myGroups.length === 0 && (
        <div className="mt-8">
          <EmptyState
            headline={t('groups.startFirst')}
            body={t('groupsPage.emptyBody')}
            action={<Button onClick={() => setComposing(true)}>{t('groups.newGroup')}</Button>}
          />
        </div>
      )}

      {activeGroups.length > 0 && <GroupSection title={t('groupsPage.active')} groups={activeGroups} />}
      {closedGroups.length > 0 && <GroupSection title={t('groupsPage.closed')} groups={closedGroups} />}
    </PageContainer>
  );
}

function GroupSection({ title, groups }: { title: string; groups: GroupWithRole[] }) {
  const { t } = useTranslation();
  const locale = useLocale();

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
                {/* No status badge: the section heading already says open or closed, and every
                    card carrying an identical "planned" pill said nothing. */}
                <p className="font-semibold text-ink">{group.name}</p>
                {group.description && (
                  <p className="mt-1 text-sm text-ink-secondary">{group.description}</p>
                )}
                <p className="mt-3 text-sm text-ink-secondary">
                  {group.nextActivityAt
                    ? t('groups.nextAt', {
                        when: new Date(group.nextActivityAt).toLocaleString(locale, {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        }),
                      })
                    : t('groups.nothingScheduled')}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
