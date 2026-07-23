import { Router } from 'express';
import { roleElevationSchema } from '@meetingpnt/shared';
import type { Role } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import * as adminService from './service.js';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('admin'));

adminRouter.get('/users', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const role = typeof req.query.role === 'string' ? (req.query.role as Role) : undefined;
    const users = await adminService.listUsers({ search, role });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch(
  '/users/:id/role',
  validate(roleElevationSchema),
  async (req, res, next) => {
    try {
      const targetId = req.params.id as string;
      const user = await adminService.elevateUserRole(req.user!.id, targetId, req.body.role);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);
