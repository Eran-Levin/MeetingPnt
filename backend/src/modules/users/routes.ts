import { Router } from 'express';
import { pushTokenSchema } from '@meetingpnt/shared';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.post('/push-token', validate(pushTokenSchema), async (req, res, next) => {
  try {
    await prisma.pushToken.upsert({
      where: {
        userId_expoPushToken: { userId: req.user!.id, expoPushToken: req.body.expoPushToken },
      },
      create: {
        userId: req.user!.id,
        expoPushToken: req.body.expoPushToken,
        platform: req.body.platform,
      },
      update: { platform: req.body.platform },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
