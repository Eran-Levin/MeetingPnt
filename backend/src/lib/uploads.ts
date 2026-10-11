import { GetObjectCommand } from '@aws-sdk/client-s3';
import express, { Router } from 'express';
import { env } from '../config/env.js';
import { UPLOADS_DIR, getS3 } from './storage.js';

/** Exactly what `saveImage` writes — a random UUID and an image extension. Anything else is not ours. */
const UPLOAD_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Serves `/uploads/<file>`.
 *
 * Local disk: static files, as before. Bucket: the bucket can stay **private** and the server
 * hands out each photo itself, fetching it with its own key. That is what lets this run on a free
 * Backblaze account, where making a bucket public needs a card on file. The address is permanent
 * (a random name, never signed or expiring) and the response is cacheable forever, so a phone
 * loads each photo once.
 *
 * Portal and phone are on other origins than the API, so cross-origin loads have to be allowed.
 */
export function uploadsRouter(): Router {
  const router = Router();
  const crossOrigin = { 'Cross-Origin-Resource-Policy': 'cross-origin' };

  router.use(
    express.static(UPLOADS_DIR, { setHeaders: (res) => res.set(crossOrigin) }),
  );

  if (env.STORAGE_DRIVER === 's3') {
    router.get('/:filename', async (req, res, next) => {
      const { filename } = req.params;
      if (!UPLOAD_NAME.test(filename)) {
        return res.status(404).end();
      }
      try {
        const object = await getS3().send(
          new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: filename }),
        );
        const bytes = await object.Body!.transformToByteArray();
        res
          .set(crossOrigin)
          .set('Content-Type', CONTENT_TYPE[filename.split('.').pop()!]!)
          .set('Cache-Control', 'public, max-age=31536000, immutable')
          .send(Buffer.from(bytes));
      } catch (err) {
        if ((err as { name?: string }).name === 'NoSuchKey') {
          return res.status(404).end();
        }
        next(err);
      }
    });
  }

  return router;
}
