import { email, z } from 'zod';

// ─── Helper Tools ─────────────────────────────────────────────────────────────────

const customBodyErrorMessage = err =>
  err.input === undefined
  ? `Body is required`
  : 'Body must be an object';

const collapseWhitespace = val => val.replace(/\s+/g, ' ');

// ─── Helper Schemas ───────────────────────────────────────────────────────────────

const stringFieldSchema = fieldName =>
  z.string({
    // customize error messages
    error: err => err.input === undefined
    ? `${fieldName} is required`
    : `${fieldName} must be a string`
  })
  .trim()
  .min(1, `${fieldName} is required`);

const passwordSchema = stringFieldSchema('Password')
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must not exceed 72 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol');

const emailSchema = stringFieldSchema('Email')
  .pipe(z.email('Email is invalid'))
  .transform(email => email.toLowerCase());

// ─── Main Schemas ─────────────────────────────────────────────────────────────────

export const signupSchema = z.object({
  body: z.object({
    name: stringFieldSchema('Name')
      .transform(collapseWhitespace)
      .pipe(
        z.string()
          .min(2, 'Name must be at least 2 characters')
          .max(100, 'Name must be at most 100 characters')
      ),

    email: emailSchema,
    password: passwordSchema,
    confirmPassword: stringFieldSchema('Confirm Password')
  },
  {
    error: customBodyErrorMessage
  })
  .strict()
  .refine(
    body => body.password === body.confirmPassword,
    { message: 'Passwords don\'t match', path: ['confirmPassword'] }
  ),

  query: z.unknown(),
  params: z.unknown()
}).strict();

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: stringFieldSchema('Password')
      .max(72, 'Password must not exceed 72 characters')
  },
  {
    error: customBodyErrorMessage
  }).strict(),

  query: z.unknown(),
  params: z.unknown(),
}).strict();

export const forgetPasswordSchema = z.object({
  body: z.object({
    email: emailSchema
  },
  {
    error: customBodyErrorMessage
  }).strict(),

  params: z.unknown(),
  query: z.unknown()
}).strict();

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: stringFieldSchema('Confirm Password')
  },
  {
    error: customBodyErrorMessage
  })
  .strict()
  .refine(
    body => body.confirmPassword === body.password,
    { message: 'Passwords don\'t match', path: ['confirmPassword'] }
  ),

  params: z.unknown(),
  query: z.unknown()
});

export const updatePasswordSchema = z.object({
  body: z.object({
    curPassword: stringFieldSchema('Current Password')
      .max(72, 'Current password must not exceed 72 characters'),
    newPassword: passwordSchema,
    confirmPassword: stringFieldSchema('Confirm Password')
  },
  {
    error: customBodyErrorMessage
  })
  .strict()
  .refine(
    body => body.curPassword !== body.newPassword,
    { message: 'New password must be different from the current one', path: ['newPassword'] }
  )
  .refine(
    data => data.newPassword === data.confirmPassword,
    { message: 'Passwords don\'t match', path: ['confirmPassword'] }
  ),

  params: z.unknown(),
  query: z.unknown(),
}).strict();

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1, 'Verification token is required')
  },
  {
    error: customBodyErrorMessage
  }).strict(),
  params: z.unknown(),
  query: z.unknown()
}).strict();
