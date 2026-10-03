import { Router } from 'express';
import { addPartyMembersSchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as partiesService from './service.js';

export const partiesRouter = Router();

partiesRouter.use(authenticate);

partiesRouter.post<{ partyId: string }>(
  '/:partyId/members',
  validate(addPartyMembersSchema),
  async (req, res, next) => {
    try {
      const result = await partiesService.addPartyMembers(
        req.params.partyId,
        req.user!.id,
        req.body,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);
