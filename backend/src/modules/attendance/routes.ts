import { Router } from 'express';
import { updateAttendanceSchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as attendanceService from './service.js';

/** Roll call for one meeting point: /api/meeting-points/:id/attendance */
export const meetingPointAttendanceRouter = Router({ mergeParams: true });

meetingPointAttendanceRouter.use(authenticate);

meetingPointAttendanceRouter.put<{ meetingPointId: string }>(
  '/',
  validate(updateAttendanceSchema),
  async (req, res, next) => {
    try {
      const attendance = await attendanceService.updateAttendance(
        req.params.meetingPointId,
        req.user!.id,
        req.body,
      );
      res.json({ attendance });
    } catch (err) {
      next(err);
    }
  },
);

meetingPointAttendanceRouter.get<{ meetingPointId: string }>('/roll-call', async (req, res, next) => {
  try {
    const entries = await attendanceService.getRollCall(req.params.meetingPointId, req.user!.id);
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

meetingPointAttendanceRouter.get<{ meetingPointId: string }>('/', async (req, res, next) => {
  try {
    const attendance = await attendanceService.listAttendance(
      req.params.meetingPointId,
      req.user!.id,
    );
    res.json({ attendance });
  } catch (err) {
    next(err);
  }
});

/** Activity-wide views: /api/activities/:id/attendance and .../participation */
export const activityAttendanceRouter = Router();

activityAttendanceRouter.use(authenticate);

activityAttendanceRouter.get('/:id/attendance', async (req, res, next) => {
  try {
    const attendance = await attendanceService.listActivityAttendance(
      req.params.id as string,
      req.user!.id,
    );
    res.json({ attendance });
  } catch (err) {
    next(err);
  }
});

activityAttendanceRouter.get('/:id/participation', async (req, res, next) => {
  try {
    const participation = await attendanceService.listActivityParticipation(
      req.params.id as string,
      req.user!.id,
    );
    res.json({ participation });
  } catch (err) {
    next(err);
  }
});
