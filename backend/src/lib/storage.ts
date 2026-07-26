import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
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

/** Saves an image to local disk under `uploads/` and returns its publicly reachable URL.
 * Swap this function's implementation to target S3/Cloudinary/etc. without touching callers. */
export async function saveImage(buffer: Buffer, mime: string): Promise<string> {
  const extension = EXTENSION_BY_MIME[mime];
  if (!extension) {
    throw new Error(`Unsupported image type: ${mime}`);
  }

  await mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);

  return `${env.BACKEND_PUBLIC_URL}/uploads/${filename}`;
}
