import type { RsvpWithUser } from '@meetingpnt/shared';
import { Badge } from './ui/Badge.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';
import { EmptyState } from './ui/Skeleton.js';

interface Props {
  rsvps: RsvpWithUser[];
  loading: boolean;
  savingFor: string | null;
  error: string | null;
  onSet: (userId: string, status: 'approved' | 'declined') => void;
}

/**
 * Who's coming, as a list rather than a table.
 *
 * It was four columns wide, one of which was the note — and the note is empty for almost everyone,
 * so a quarter of the width rendered a column of em-dashes. As a list it fits beside the itinerary,
 * which is what a leader actually wants: build the route while watching the replies come in.
 */
export function AttendancePanel({ rsvps, loading, savingFor, error, onSet }: Props) {
  const going = rsvps.filter((r) => r.status === 'approved').length;
  const declined = rsvps.filter((r) => r.status === 'declined').length;
  const waiting = rsvps.length - going - declined;

  return (
    <>
      {error && (
        <p className="mt-2 rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Tally value={going} label="going" />
        <Tally value={waiting} label="no reply" />
        <Tally value={declined} label="declined" />
      </div>

      {loading ? null : rsvps.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            headline="No replies yet"
            body="Members appear here as soon as they answer — you can also record a reply for them."
          />
        </div>
      ) : (
        <Card className="mt-3 divide-y divide-line p-0">
          {rsvps.map((rsvp) => (
            <div key={rsvp.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="text-sm text-ink">{rsvp.user.name}</span>
                  {rsvp.isVisitor && (
                    <span className="ml-2 rounded-full bg-tone-info-bg px-2 py-0.5 text-xs font-medium text-tone-info-fg">
                      Visitor
                    </span>
                  )}
                  <span className="block truncate text-xs text-ink-muted">{rsvp.user.email}</span>
                </span>
                <Badge status={rsvp.status} />
              </div>

              {/* The note is where "bringing my daughter" and "arriving late" live — worth reading,
                  never worth a column of its own. */}
              {rsvp.note && <p className="mt-1 text-sm text-ink-secondary">{rsvp.note}</p>}

              {/* Members often reply by phone days ahead — the leader records it here. */}
              <div className="mt-2 flex gap-1.5">
                <Button
                  size="sm"
                  variant={rsvp.status === 'approved' ? 'primary' : 'secondary'}
                  disabled={savingFor === rsvp.userId || rsvp.status === 'approved'}
                  onClick={() => onSet(rsvp.userId, 'approved')}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant={rsvp.status === 'declined' ? 'primary' : 'secondary'}
                  disabled={savingFor === rsvp.userId || rsvp.status === 'declined'}
                  onClick={() => onSet(rsvp.userId, 'declined')}
                >
                  Won&apos;t arrive
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function Tally({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-surface-raised px-3 py-2">
      <p className="text-xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-ink-secondary">{label}</p>
    </div>
  );
}
