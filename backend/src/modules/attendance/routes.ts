import { Router } from 'express';
import { updateAttendanceSchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as attendanceService from './service.js';

export const attendanceRouter = Router();

attendanceRouter.use(authenticate);

attendanceRouter.put('/:id/attendance', validate(updateAttendanceSchema), async (req, res, next) => {
  try {
    const attendance = await attendanceService.updateAttendance(
      req.params.id as string,
      req.user!.id,
      req.body,
    );
    res.json({ attendance });
  } catch (err) {
    next(err);
  }
});

attendanceRouter.get('/:id/attendance', async (req, res, next) => {
  try {
    const attendance = await attendanceService.listAttendance(req.params.id as string, req.user!.id);
    res.json({ attendance });
  } catch (err) {
    next(err);
  }
});
