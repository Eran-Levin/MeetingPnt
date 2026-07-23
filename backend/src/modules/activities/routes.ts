import { Router } from 'express';
import { createActivitySchema, updateActivitySchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as activitiesService from './service.js';

// Nested under /api/groups/:groupId/activities
export const groupActivitiesRouter = Router({ mergeParams: true });

groupActivitiesRouter.use(authenticate);

groupActivitiesRouter.post<{ groupId: string }>(
  '/',
  validate(createActivitySchema),
  async (req, res, next) => {
    try {
      const activity = await activitiesService.createActivity(req.params.groupId, req.user!.id, req.body);
      res.status(201).json({ activity });
    } catch (err) {
      next(err);
    }
  },
);

groupActivitiesRouter.get<{ groupId: string }>('/', async (req, res, next) => {
  try {
    const activities = await activitiesService.listActivities(req.params.groupId, req.user!.id);
    res.json({ activities });
  } catch (err) {
    next(err);
  }
});

// Standalone /api/activities/:id
export const activitiesRouter = Router();

activitiesRouter.use(authenticate);

activitiesRouter.get('/:id', async (req, res, next) => {
  try {
    const activity = await activitiesService.getActivity(req.params.id as string, req.user!.id);
    res.json({ activity });
  } catch (err) {
    next(err);
  }
});

activitiesRouter.patch('/:id', validate(updateActivitySchema), async (req, res, next) => {
  try {
    const activity = await activitiesService.updateActivity(
      req.params.id as string,
      req.user!.id,
      req.body,
    );
    res.json({ activity });
  } catch (err) {
    next(err);
  }
});

activitiesRouter.post('/:id/publish', async (req, res, next) => {
  try {
    const activity = await activitiesService.publishActivity(req.params.id as string, req.user!.id);
    res.json({ activity });
  } catch (err) {
    next(err);
  }
});

activitiesRouter.delete('/:id', async (req, res, next) => {
  try {
    await activitiesService.deleteActivity(req.params.id as string, req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

activitiesRouter.get('/:id/ics', async (req, res, next) => {
  try {
    const ics = await activitiesService.generateIcs(req.params.id as string, req.user!.id);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="activity.ics"');
    res.send(ics);
  } catch (err) {
    next(err);
  }
});
