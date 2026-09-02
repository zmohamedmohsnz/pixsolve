// this module loads env variables into `process.env`
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
});

// ─── Validate Env ───────────────────────────────────────────────────────────────

// `safeParse` doesn't throw an error automatically 
const result = envSchema.safeParse(process.env);

// throw custom error message
if (!result.success) {
  const details = result.error.issues
    .map(issue => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${details}`);
}

const config = Object.freeze({
  nodeEnv: result.data.NODE_ENV,
  port: result.data.PORT,
  dbUri: result.data.DB_URI,
  logLevel: result.data.LOG_LEVEL ?? (result.data.NODE_ENV === 'production' ? 'info' : 'debug'),
});

export default config;