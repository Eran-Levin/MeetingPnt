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

rsvpsRouter.get('/:id/rsvp/me', async (req, res, next) => {
  try {
    const rsvp = await rsvpsService.getMyRsvp(req.params.id as string, req.user!.id);
    res.json({ rsvp });
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
