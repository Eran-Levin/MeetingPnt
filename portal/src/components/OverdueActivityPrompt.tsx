import type { ActivityWithGroup } from '@meetingpnt/shared';
import { formatActivityWhen } from '@meetingpnt/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { activitiesApi } from '../api/activitiesApi.js';
import { Button } from './ui/Button.js';

/**
 * A leader who walked away without ending the event: it stays in_progress indefinitely, keeps
 * location sharing open for everyone on the roster, and blocks starting the next one — a leader
 * runs one at a time. So ask on arrival, wherever they land, rather than only on the activity's
 * own page (which is the page they've demonstrably not opened).
 *
 * Only the leader is asked: a member can't end anything.
 */
export function OverdueActivityPrompt() {
  const queryClient = useQueryClient();
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['activities', 'mine'],
    queryFn: () => activitiesApi.listMine(),
  });

  const end = useMutation({
    mutationFn: (id: string) => activitiesApi.end(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities', 'mine'] }),
  });

  const now = Date.now();
  const overdue = (data?.activities ?? []).find(
    (a: ActivityWithGroup) =>
      a.isLeader && a.status === 'in_progress' && new Date(a.endAt).getTime() < now,
  );

  if (!overdue || overdue.id === dismissedId) return null;

  return (
    <div className="border-b border-line bg-tone-warning-bg">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{overdue.title} is still running</p>
          <p className="mt-0.5 text-sm text-ink-secondary">
            It was scheduled for{' '}
            {formatActivityWhen(overdue.startAt, overdue.endAt, overdue.allDay)} and hasn't been
            ended. Ending it stops location sharing; attendance stays editable.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={() => end.mutate(overdue.id)} disabled={end.isPending}>
            {end.isPending ? 'Ending…' : 'End activity'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDismissedId(overdue.id)}>
            Keep it running
          </Button>
        </div>
      </div>
    </div>
  );
}
