// ─── Import Modules ─────────────────────────────────────────────────────────────

// this side-effect import loads the environment
// variables from `.env` file into `process.env`.
import 'dotenv/config';
import { z } from 'zod';

// ─── Define the Schema ──────────────────────────────────────────────────────────

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('production'),

  PORT: z.coerce.number()
    .int('PORT must be an integer')
    .min(1, 'PORT must be at least 1')
    .max(65535, 'PORT must not exceed 65535'),

  DB_URI: z.string()
    .trim()
    .min(1, "DB_URI is required"),

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .optional(),

  REDIS_URL: z.url({
    protocol: /^rediss?$/, // permits only 'redis' or 'rediss'
    hostname: /^.+$/, // requires non-empty hostname
    error: 'REDIS_URL must be a valid redis:// or rediss:// URL with a hostname'
  }),

  CLOUDINARY_CLOUD_NAME: z.string()
    .trim()
    .min(1, 'CLOUDINARY_CLOUD_NAME is required'),

  CLOUDINARY_API_KEY: z.string()
    .trim()
    .min(1, 'CLOUDINARY_API_KEY is required'),
  
  CLOUDINARY_API_SECRET: z.string()
    .trim()
    .min(1, 'CLOUDINARY_API_SECRET is required'),
  
  RESEND_API_KEY: z.string()
    .trim()
    .min(1, 'RESEND_API_KEY is required'),
  
  RESEND_FROM_EMAIL: z.string()
    .trim()
    .pipe(z.email()),

  EMAIL_VERIFICATION_TOKEN_LIFETIME_MINS: z.coerce.number()
    .int('Verification Token TTL must be an integer')
    .min(1, 'Verification Token TTL must be at least 1'),
  
  PUBLIC_API_URL: z.url({
    protocol: /^https?$/,
    hostname: /^.+$/,
    error: 'PUBLIC_API_URL must be a valid http:// or https:// URL with a hostname'
  })
  .refine(value => {
    const url = new URL(value);

    return url.pathname === '/' &&
      url.search === '' &&
      url.hash === '';
  }, 'PUBLIC_API_URL must be an origin without a path, query, or fragment')
  .transform(value => value.replace(/\/+$/, '')),
});

// ─── Validate Env Variables ─────────────────────────────────────────────────────

// `safeParse` doesn't throw an error automatically 
const result = envSchema.safeParse(process.env);

// throw custom error message
if (!result.success) {
  const details = result.error.issues
    .map(issue => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${details}`);
}

// ─── Export Env Variables ─────────────────────────────────────────────────────

const config = Object.freeze({
  nodeEnv: result.data.NODE_ENV,
  port: result.data.PORT,
  dbUri: result.data.DB_URI,
  logLevel: result.data.LOG_LEVEL ?? (result.data.NODE_ENV === 'production' ? 'info' : 'debug'),
  redisUrl: result.data.REDIS_URL,
  cloudinary: Object.freeze({
    cloudName: result.data.CLOUDINARY_CLOUD_NAME,
    apiKey: result.data.CLOUDINARY_API_KEY,
    apiSecret: result.data.CLOUDINARY_API_SECRET,
  }),
  email: Object.freeze({
    apiKey: result.data.RESEND_API_KEY,
    fromEmail: result.data.RESEND_FROM_EMAIL
  }),
  emailVerificationTokenLifeTimeMins: result.data.EMAIL_VERIFICATION_TOKEN_LIFETIME_MINS,
  publicApiUrl: result.data.PUBLIC_API_URL,
});

export default config;