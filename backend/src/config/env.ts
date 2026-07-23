import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  REDIS_URL: z.string().min(1),
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_EMAIL: z.string().optional().default('onboarding@resend.dev'),
  PORTAL_URL: z.string().default('http://localhost:5173'),
  MOBILE_DEEP_LINK_SCHEME: z.string().default('meetingpnt'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@meetingpnt.dev'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('changeme123'),
  SEED_ADMIN_NAME: z.string().default('MeetingPnt Admin'),
});

export const env = envSchema.parse(process.env);

export const corsOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
