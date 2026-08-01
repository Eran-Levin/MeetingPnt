import { Router } from 'express';
import { rsvpUpdateSchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as rsvpsService from './service.js';

export const rsvpsRouter = Router();

rsvpsRouter.use(authenticate);

rsvpsRouter.post('/:id/rsvp', validate(rsvpUpdateSchema), async (req, res, next) => {
  try {
    const rsvp = await rsvpsService.upsertRsvp(req.params.id as string, req.user!.id, req.body);
    res.json({ rsvp });
  } catch (err) {
    next(err);
  }
});

// Leader answering for a member: "told me by phone they can't make it".
rsvpsRouter.put<{ id: string; userId: string }>(
  '/:id/rsvps/:userId',
  validate(rsvpUpdateSchema),
  async (req, res, next) => {
    try {
      const rsvp = await rsvpsService.setRsvpAsLeader(
        req.params.id,
        req.params.userId,
        req.user!.id,
        req.body,
      );
      res.json({ rsvp });
    } catch (err) {
      next(err);
    }
  },
);

rsvpsRouter.get('/:id/rsvp/me', async (req, res, next) => {
  try {
    const rsvp = await rsvpsService.getMyRsvp(req.params.id as string, req.user!.id);
    res.json({ rsvp });
  } catch (err) {
    next(err);
  }
});

// Any participant: who's confirmed as coming. Names only, no attendance.
rsvpsRouter.get('/:id/attendees', async (req, res, next) => {
  try {
    const attendees = await rsvpsService.listAttendees(req.params.id as string, req.user!.id);
    res.json({ attendees });
  } catch (err) {
    next(err);
  }
});

rsvpsRouter.get('/:id/rsvps', async (req, res, next) => {
  try {
    const rsvps = await rsvpsService.listRsvps(req.params.id as string, req.user!.id);
    res.json({ rsvps });
  } catch (err) {
    next(err);
  }
});
