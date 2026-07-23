import { Router } from 'express';
import { inviteMemberSchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as invitationsService from './service.js';

export const invitationsRouter = Router();

// Nested under /api/groups/:groupId/invitations
export const groupInvitationsRouter = Router({ mergeParams: true });

groupInvitationsRouter.use(authenticate);

groupInvitationsRouter.post<{ groupId: string }>(
  '/',
  validate(inviteMemberSchema),
  async (req, res, next) => {
    try {
      const result = await invitationsService.inviteMember(
        req.params.groupId,
        req.user!.id,
        req.body,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

groupInvitationsRouter.get<{ groupId: string }>('/', async (req, res, next) => {
  try {
    const invitations = await invitationsService.listPendingInvitations(
      req.params.groupId,
      req.user!.id,
    );
    res.json({ invitations });
  } catch (err) {
    next(err);
  }
});

// Standalone /api/invitations/:token (public preview) and /api/invitations/:id (revoke)
invitationsRouter.get('/:token', async (req, res, next) => {
  try {
    const preview = await invitationsService.previewInvitation(req.params.token as string);
    res.json(preview);
  } catch (err) {
    next(err);
  }
});

invitationsRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await invitationsService.revokeInvitation(req.params.id as string, req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
