// this module loads env variables into `process.env`
import 'dotenv/config';
import { z } from 'zod';

// ─── Define the Schema ──────────────────────────────────────────────────────────

const envSchema = z.object({
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
});

export default config;