import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  BACKEND_PUBLIC_URL: z.string().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  // Optional: only fans Socket.IO events out across instances. A single instance needs no Redis.
  REDIS_URL: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_EMAIL: z.string().optional().default('onboarding@resend.dev'),
  PORTAL_URL: z.string().default('http://localhost:5173'),
  MOBILE_DEEP_LINK_SCHEME: z.string().default('meetingpnt'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@meetingpnt.dev'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('changeme123'),
  SEED_ADMIN_NAME: z.string().default('MeetingPnt Admin'),
  // Where uploaded photos go. `local` writes to this server's disk (development); `s3` sends them
  // to an S3-compatible bucket (Backblaze B2, Cloudflare R2, MinIO), which is what any host with an
  // ephemeral disk needs. The S3_* values are only read, and only required, for `s3`.
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().default(''),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  // Where a browser or phone loads an uploaded file from, e.g. https://f004.backblazeb2.com/file/<bucket>
  S3_PUBLIC_BASE_URL: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw parsed.error;
}
if (parsed.data.STORAGE_DRIVER === 's3') {
  // Fail at boot, naming what is missing, rather than on the first photo someone uploads.
  const missing = (
    ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL'] as const
  ).filter((key) => !parsed.data[key]);
  if (missing.length > 0) {
    throw new Error(`STORAGE_DRIVER=s3 needs ${missing.join(', ')} to be set`);
  }
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
