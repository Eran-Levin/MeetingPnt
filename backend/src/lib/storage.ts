import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isSupportedImageMime(mime: string): boolean {
  return mime in EXTENSION_BY_MIME;
}

/**
 * Built on first use, so a local run with no bucket configured never constructs it. Path-style
 * addressing because it is the form every S3-compatible store accepts (Backblaze B2, Cloudflare
 * R2, MinIO) — virtual-hosted style only works where the provider has set up wildcard DNS.
 */
let s3: S3Client | null = null;
export function getS3(): S3Client {
  s3 ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return s3;
}

/** Where uploaded photos are addressed from, with no trailing slash however the variables were typed. */
function uploadsBaseUrl(): string {
  const base = env.S3_PUBLIC_BASE_URL || `${env.BACKEND_PUBLIC_URL.replace(/\/+$/, '')}/uploads`;
  return base.replace(/\/+$/, '');
}

/**
 * Saves an image and returns the URL clients should load it from.
 *
 * `STORAGE_DRIVER=local` (the default) writes under `uploads/` and serves it from this server —
 * right for development, wrong for any host with an ephemeral disk, where the files vanish on
 * every restart. `STORAGE_DRIVER=s3` sends it to an S3-compatible bucket, so the image outlives
 * the server. The URL is then either:
 *
 *  - `S3_PUBLIC_BASE_URL` is set: the bucket's own public address (the bucket must be public), or
 *  - not set: this server's `/uploads/` address, which fetches the photo from the bucket (see
 *    `uploadsRouter`). That works with a **private** bucket — the only option on a free Backblaze
 *    account, where making a bucket public needs a card on file.
 */
export async function saveImage(buffer: Buffer, mime: string): Promise<string> {
  const extension = EXTENSION_BY_MIME[mime];
  if (!extension) {
    throw new Error(`Unsupported image type: ${mime}`);
  }
  const filename = `${randomUUID()}.${extension}`;

  if (env.STORAGE_DRIVER === 's3') {
    await getS3().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: filename,
        Body: buffer,
        ContentType: mime,
        // The name is a random UUID and the content never changes under it.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${uploadsBaseUrl()}/${filename}`;
  }

  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);

  return `${env.BACKEND_PUBLIC_URL.replace(/\/+$/, '')}/uploads/${filename}`;
}
