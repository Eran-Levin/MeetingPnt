import { Router } from 'express';
import { omwLocationSchema, pingRequestSchema, pingResponseSchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as locationsService from './service.js';

export const locationsRouter = Router();

locationsRouter.use(authenticate);

locationsRouter.post('/:id/location/omw', validate(omwLocationSchema), async (req, res, next) => {
  try {
    const snapshot = await locationsService.submitOmw(req.params.id as string, req.user!.id, req.body);
    res.json({ snapshot });
  } catch (err) {
    next(err);
  }
});

locationsRouter.post(
  '/:id/location/ping-response',
  validate(pingResponseSchema),
  async (req, res, next) => {
    try {
      const snapshot = await locationsService.submitPingResponse(
        req.params.id as string,
        req.user!.id,
        req.body,
      );
      res.json({ snapshot });
    } catch (err) {
      next(err);
    }
  },
);

locationsRouter.post(
  '/:id/location/ping',
  validate(pingRequestSchema),
  async (req, res, next) => {
    try {
      await locationsService.requestPing(req.params.id as string, req.user!.id, req.body);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// "Follow me" — the leader holding up a flag. Start/stop manage the lease; fixes come in through
// /broadcast while it's running.
locationsRouter.post('/:id/location/broadcast/start', async (req, res, next) => {
  try {
    res.json(await locationsService.startLeaderBroadcast(req.params.id as string, req.user!.id));
  } catch (err) {
    next(err);
  }
});

locationsRouter.post('/:id/location/broadcast/stop', async (req, res, next) => {
  try {
    res.json(await locationsService.stopLeaderBroadcast(req.params.id as string, req.user!.id));
  } catch (err) {
    next(err);
  }
});

locationsRouter.post(
  '/:id/location/broadcast',
  validate(omwLocationSchema),
  async (req, res, next) => {
    try {
      const snapshot = await locationsService.recordBroadcastFix(
        req.params.id as string,
        req.user!.id,
        req.body,
      );
      res.json({ snapshot });
    } catch (err) {
      next(err);
    }
  },
);

// The mirror of /location/ping: that one is the leader asking a member, this is a member asking
// the leader. No body — who is asking comes from the token, and who they're asking is the
// activity's leader.
locationsRouter.post('/:id/location/ask-leader', async (req, res, next) => {
  try {
    const result = await locationsService.requestLeaderLocation(
      req.params.id as string,
      req.user!.id,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// The pair: /latest is the leader's view of everyone, /leader is everyone's view of the leader.
locationsRouter.get('/:id/location/leader', async (req, res, next) => {
  try {
    const location = await locationsService.getLeaderLocation(req.params.id as string, req.user!.id);
    res.json({ location });
  } catch (err) {
    next(err);
  }
});

locationsRouter.get('/:id/location/latest', async (req, res, next) => {
  try {
    const locations = await locationsService.getLatestLocations(req.params.id as string, req.user!.id);
    res.json({ locations });
  } catch (err) {
    next(err);
  }
});
