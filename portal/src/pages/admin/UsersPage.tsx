import { isolate, type Role, type User } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { adminApi } from '../../api/adminApi.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { useTranslation } from '../../i18n/index.js';

const ROLES: Role[] = ['user', 'leader', 'admin'];
const ROLE_ORDER: Record<Role, number> = { admin: 0, leader: 1, user: 2 };

type SortColumn = 'name' | 'email' | 'role';
type SortDirection = 'asc' | 'desc';

function sortUsers(users: User[], column: SortColumn, direction: SortDirection): User[] {
  const sorted = [...users].sort((a, b) => {
    const cmp = column === 'role' ? ROLE_ORDER[a.role] - ROLE_ORDER[b.role] : a[column].localeCompare(b[column]);
    return direction === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export function UsersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('role');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => adminApi.listUsers({ search: search || undefined }),
  });

  const sortedUsers = useMemo(
    () => (data ? sortUsers(data.users, sortColumn, sortDirection) : []),
    [data, sortColumn, sortDirection],
  );

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  async function handleRoleChange(userId: string, userName: string, role: Role) {
    if (role === 'admin') {
      const confirmed = window.confirm(t('usersPage.makeAdmin', { name: isolate(userName) }));
      if (!confirmed) return;
    }
    await adminApi.elevateRole(userId, role);
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  }

  function SortHeader({ column, label }: { column: SortColumn; label: string }) {
    const active = sortColumn === column;
    return (
      <th className="px-4 py-3">
        <button
          type="button"
          onClick={() => handleSort(column)}
          className="flex items-center gap-1 uppercase tracking-wide text-ink-secondary hover:text-ink"
        >
          {label}
          <span className="text-ink-muted">{active ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
        </button>
      </th>
    );
  }

  return (
    <PageContainer className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-ink">{t('portal.nav.users')}</h1>
      <p className="mt-1 text-sm text-ink-secondary">{t('usersPage.subtitle')}</p>

      <input
        placeholder={t('usersPage.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-6 w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {isLoading && <p className="mt-4 text-sm text-ink-secondary">{t('common.loading')}</p>}
      {error && <p className="mt-4 text-sm text-tone-danger-fg">{t('usersPage.loadFailed')}</p>}

      {data && (
        <Card className="mt-4 overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-sunken text-start text-xs font-medium">
                <SortHeader column="name" label={t('usersPage.name')} />
                <SortHeader column="email" label={t('common.email')} />
                <SortHeader column="role" label={t('usersPage.role')} />
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">{user.name}</td>
                  <td className="px-4 py-3 text-ink-secondary">{user.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge status={user.role} />
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, user.name, e.target.value as Role)}
                        className="rounded-lg border border-line-strong bg-white px-2 py-1 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {t(`status.${role}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedUsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-ink-muted">
                    {t('usersPage.none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </PageContainer>
  );
}
