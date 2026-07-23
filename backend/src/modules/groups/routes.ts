import { Router } from 'express';
import { createGroupSchema, updateGroupSchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as groupsService from './service.js';

export const groupsRouter = Router();

groupsRouter.use(authenticate);

groupsRouter.post('/', requireRole('leader', 'admin'), validate(createGroupSchema), async (req, res, next) => {
  try {
    const group = await groupsService.createGroup(req.user!.id, req.body);
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

groupsRouter.get('/', async (req, res, next) => {
  try {
    const groups = await groupsService.listMyGroups(req.user!.id);
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

groupsRouter.get('/:id', async (req, res, next) => {
  try {
    const group = await groupsService.getGroup(req.params.id as string, req.user!.id);
    res.json({ group });
  } catch (err) {
    next(err);
  }
});

groupsRouter.patch('/:id', validate(updateGroupSchema), async (req, res, next) => {
  try {
    const group = await groupsService.updateGroup(req.params.id as string, req.user!.id, req.body);
    res.json({ group });
  } catch (err) {
    next(err);
  }
});

groupsRouter.delete('/:id', async (req, res, next) => {
  try {
    await groupsService.deleteGroup(req.params.id as string, req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

groupsRouter.get('/:id/members', async (req, res, next) => {
  try {
    const members = await groupsService.listMembers(req.params.id as string, req.user!.id);
    res.json({ members });
  } catch (err) {
    next(err);
  }
});

groupsRouter.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    await groupsService.removeMember(
      req.params.id as string,
      req.params.userId as string,
      req.user!.id,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
