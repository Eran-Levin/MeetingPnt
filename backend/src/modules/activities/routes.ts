import { Router } from 'express';
import {
  createActivitySchema,
  createMultiDayEventSchema,
  updateActivitySchema,
} from '@meetingpnt/shared';
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
      const activities = await activitiesService.createActivity(req.params.groupId, req.user!.id, req.body);
      if (req.body.recurrence) {
        res.status(201).json({ activities });
      } else {
        res.status(201).json({ activity: activities[0] });
      }
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

// Nested under /api/groups/:groupId/multi-day-events
export const groupMultiDayEventsRouter = Router({ mergeParams: true });

groupMultiDayEventsRouter.use(authenticate);

groupMultiDayEventsRouter.post<{ groupId: string }>(
  '/',
  validate(createMultiDayEventSchema),
  async (req, res, next) => {
    try {
      res
        .status(201)
        .json(await activitiesService.createMultiDayEvent(req.params.groupId, req.user!.id, req.body));
    } catch (err) {
      next(err);
    }
  },
);

groupMultiDayEventsRouter.get<{ groupId: string }>('/', async (req, res, next) => {
  try {
    const multiDayEvents = await activitiesService.listMultiDayEvents(req.params.groupId, req.user!.id);
    res.json({ multiDayEvents });
  } catch (err) {
    next(err);
  }
});

// Standalone /api/multi-day-events/:id
export const multiDayEventsRouter = Router();

multiDayEventsRouter.use(authenticate);

multiDayEventsRouter.post('/:id/publish', async (req, res, next) => {
  try {
    // `invited` is how many people the one calendar invitation is going to.
    res.json(await activitiesService.publishMultiDayEvent(req.params.id as string, req.user!.id));
  } catch (err) {
    next(err);
  }
});

// Standalone /api/activities/:id
export const activitiesRouter = Router();

activitiesRouter.use(authenticate);

// Must precede /:id, otherwise "mine" is parsed as an activity id.
activitiesRouter.get('/mine', async (req, res, next) => {
  try {
    const activities = await activitiesService.listMyActivities(req.user!.id);
    res.json({ activities });
  } catch (err) {
    next(err);
  }
});

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
    // `invited` is how many calendars the change is being sent to (0 when none needed it).
    res.json(
      await activitiesService.updateActivity(req.params.id as string, req.user!.id, req.body),
    );
  } catch (err) {
    next(err);
  }
});

activitiesRouter.post('/:id/publish', async (req, res, next) => {
  try {
    // `invited` is how many people a calendar invitation is going to.
    res.json(await activitiesService.publishActivity(req.params.id as string, req.user!.id));
  } catch (err) {
    next(err);
  }
});

activitiesRouter.post('/:id/start', async (req, res, next) => {
  try {
    const activity = await activitiesService.startActivity(req.params.id as string, req.user!.id);
    res.json({ activity });
  } catch (err) {
    next(err);
  }
});

activitiesRouter.post('/:id/end', async (req, res, next) => {
  try {
    const activity = await activitiesService.endActivity(req.params.id as string, req.user!.id);
    res.json({ activity });
  } catch (err) {
    next(err);
  }
});

activitiesRouter.post('/series/:seriesId/publish', async (req, res, next) => {
  try {
    res.json(await activitiesService.publishSeries(req.params.seriesId as string, req.user!.id));
  } catch (err) {
    next(err);
  }
});

activitiesRouter.delete('/:id', async (req, res, next) => {
  try {
    res.json(await activitiesService.deleteActivity(req.params.id as string, req.user!.id));
  } catch (err) {
    next(err);
  }
});
