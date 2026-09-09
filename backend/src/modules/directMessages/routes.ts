import { Router } from 'express';
import multer from 'multer';
import { sendMessageSchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as directMessagesService from './service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const directMessagesRouter = Router();

directMessagesRouter.use(authenticate);

directMessagesRouter.get('/:userId', async (req, res, next) => {
  try {
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const thread = await directMessagesService.getThread(req.user!.id, req.params.userId as string, {
      before,
    });
    res.json({ thread });
  } catch (err) {
    next(err);
  }
});

directMessagesRouter.post(
  '/:userId',
  upload.single('image'),
  validate(sendMessageSchema),
  async (req, res, next) => {
    try {
      const message = await directMessagesService.sendDirectMessage(
        req.user!.id,
        req.params.userId as string,
        req.body,
        req.file,
      );
      res.status(201).json({ message });
    } catch (err) {
      next(err);
    }
  },
);
