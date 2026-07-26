import type { RsvpWithUser } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../api/attendanceApi.js';
import { Badge } from './ui/Badge.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';

interface Props {
  activityId: string;
  approvedRsvps: RsvpWithUser[];
}

export function AttendancePanel({ activityId, approvedRsvps }: Props) {
  const queryClient = useQueryClient();

  const attendanceQuery = useQuery({
    queryKey: ['activities', activityId, 'attendance'],
    queryFn: () => attendanceApi.list(activityId),
  });

  const attendanceByUser = new Map(
    attendanceQuery.data?.attendance.map((record) => [record.userId, record]) ?? [],
  );

  async function handleMark(userId: string, status: 'present' | 'absent') {
    await attendanceApi.mark(activityId, userId, status);
    queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'attendance'] });
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">Attendance</h2>
      <p className="mt-1 text-sm text-slate-500">Roll call for who actually showed up.</p>

      <Card className="mt-3 divide-y divide-slate-100 p-0">
        {approvedRsvps.map((rsvp) => {
          const record = attendanceByUser.get(rsvp.userId);
          return (
            <div key={rsvp.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-slate-700">
                {rsvp.user.name} <span className="text-slate-400">({rsvp.user.email})</span>
              </span>
              <div className="flex items-center gap-2">
                {record && <Badge status={record.status} />}
                <Button
                  variant={record?.status === 'present' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleMark(rsvp.userId, 'present')}
                >
                  Present
                </Button>
                <Button
                  variant={record?.status === 'absent' ? 'danger' : 'secondary'}
                  size="sm"
                  onClick={() => handleMark(rsvp.userId, 'absent')}
                >
                  Absent
                </Button>
              </div>
            </div>
          );
        })}
        {approvedRsvps.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">
            No approved attendees yet to mark.
          </p>
        )}
      </Card>
    </section>
  );
}
