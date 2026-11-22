import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '../api/groupsApi.js';
import { useAuthStore } from '../store/authStore.js';

/**
 * The zone an event in this group runs in when it sets none of its own: the group's, else the
 * leader's. Null while neither is set — forms then read the browser's clock, as they always did.
 */
export function useInheritedZone(groupId: string | undefined): string | null {
  const leaderZone = useAuthStore((s) => s.user?.timeZone ?? null);
  const group = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.get(groupId!),
    enabled: !!groupId,
  });
  return group.data?.group.timeZone ?? leaderZone;
}
