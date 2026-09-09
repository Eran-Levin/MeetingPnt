import { Router } from 'express';
import multer from 'multer';
import { pushTokenSchema } from '@meetingpnt/shared';
import { prisma } from '../../db/prisma.js';
import { isSupportedImageMime, saveImage } from '../../lib/storage.js';
import { toSharedUser } from '../../lib/userName.js';
import { authenticate } from '../../middleware/authenticate.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { validate } from '../../middleware/validate.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const usersRouter = Router();

usersRouter.use(authenticate);

/**
 * A photo of themselves, taken on the phone. Returns the whole user rather than the URL, so the
 * client replaces its session user instead of patching a field into it.
 */
usersRouter.put('/me/avatar', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, 'No image uploaded');
    }
    if (!isSupportedImageMime(req.file.mimetype)) {
      throw new HttpError(400, 'Unsupported image type — use JPEG, PNG, or WebP');
    }
    const avatarUrl = await saveImage(req.file.buffer, req.file.mimetype);
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl } });
    res.json({ user: toSharedUser(user) });
  } catch (err) {
    next(err);
  }
});

/** The old file stays on disk — nothing else points at it, and losing a photo to a failed write
 * is worse than an orphan. A sweep can collect them (see BACKLOG). */
usersRouter.delete('/me/avatar', async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: null },
    });
    res.json({ user: toSharedUser(user) });
  } catch (err) {
    next(err);
  }
});

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
