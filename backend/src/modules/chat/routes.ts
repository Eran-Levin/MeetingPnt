import { Router } from 'express';
import multer from 'multer';
import { sendMessageSchema } from '@meetingpnt/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import * as chatService from './service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const chatRouter = Router();

chatRouter.use(authenticate);

chatRouter.get('/:id/messages', async (req, res, next) => {
  try {
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const messages = await chatService.listMessages(req.params.id as string, req.user!.id, { before });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

chatRouter.post(
  '/:id/messages',
  upload.single('image'),
  validate(sendMessageSchema),
  async (req, res, next) => {
    try {
      const message = await chatService.sendMessage(
        req.params.id as string,
        req.user!.id,
        req.body,
        req.file,
      );
      res.status(201).json({ message });
    } catch (err) {
      next(err);
    }
  },
);
