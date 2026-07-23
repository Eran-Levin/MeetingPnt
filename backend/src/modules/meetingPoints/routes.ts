import { Router } from 'express';
import { createMeetingPointSchema, updateMeetingPointSchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as meetingPointsService from './service.js';

// Nested under /api/activities/:activityId/meeting-points
export const activityMeetingPointsRouter = Router({ mergeParams: true });

activityMeetingPointsRouter.use(authenticate);

activityMeetingPointsRouter.post<{ activityId: string }>(
  '/',
  validate(createMeetingPointSchema),
  async (req, res, next) => {
    try {
      const meetingPoint = await meetingPointsService.createMeetingPoint(
        req.params.activityId,
        req.user!.id,
        req.body,
      );
      res.status(201).json({ meetingPoint });
    } catch (err) {
      next(err);
    }
  },
);

activityMeetingPointsRouter.get<{ activityId: string }>('/', async (req, res, next) => {
  try {
    const meetingPoints = await meetingPointsService.listMeetingPointsForActivity(
      req.params.activityId,
      req.user!.id,
    );
    res.json({ meetingPoints });
  } catch (err) {
    next(err);
  }
});

// Standalone /api/meeting-points/:id
export const meetingPointsRouter = Router();

meetingPointsRouter.use(authenticate);

meetingPointsRouter.patch('/:id', validate(updateMeetingPointSchema), async (req, res, next) => {
  try {
    const meetingPoint = await meetingPointsService.updateMeetingPoint(
      req.params.id as string,
      req.user!.id,
      req.body,
    );
    res.json({ meetingPoint });
  } catch (err) {
    next(err);
  }
});
