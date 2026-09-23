// ─── Import Modules ─────────────────────────────────────────────────────────────

import resend from '../config/resend.js';
import config from '../config/env.js';
import ApiError from '../errors/api-error.js';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const deliveryError = (rawError) => new ApiError(
  'This email could not be sent.',
  503,
  { 
    code: 'EMAIL_DELIVERY_FAILED',
    cause: new Error(rawError?.name ?? 'unknown')
  }
);

// ─── Base Sender Method ─────────────────────────────────────────────────────────

export const sendEmail = async ({ to, subject, text, html }) => {
  if (typeof to !== 'string' || to.trim() === '') {
    throw new TypeError('Recipient must be a non-empty string');
  }

  if (typeof subject !== 'string' || subject.trim() === '') {
    throw new TypeError('Subject must be a non-empty string');
  }

  if (typeof text !== 'string' || text.trim() === '') {
    throw new TypeError('Message must be a non-empty string');
  }

  if (html !== undefined && (typeof html !== 'string' || html.trim() === '')) {
    throw new TypeError('HTML message must be a non-empty string');
  }

  let response;

  try {
    response = await resend.emails.send({
      from: config.email.fromEmail,
      to: to.trim(),
      subject,
      text,
      ...(html !== undefined && { html })
    });
  } catch (error) {
    throw deliveryError(error);
  }

  if (response?.error || !response?.data?.id) throw deliveryError(response?.error);
};

// ─── Templates ──────────────────────────────────────────────────────────────────

export const sendVerificationEmail = async (to, verificationUrl) => {
  const text = [
    'Welcome to PixSolve.',
     '',
    `Verify your email: ${verificationUrl}`,
    '',
    'This link expires soon.'
  ].join('\n');

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your email</title>
  </head>
  <body>
    <h2>Welcome to Pixsolve!</h2>

    <p>
      Thanks for signing up. Please verify your email address to complete your registration.
    </p>

    <a href="${verificationUrl}">Verify Email</a>

    <p>This verification link will expire soon.</p>

    <p>
      If you didn't create a Pixsolve account, you can safely ignore this email.
    </p>

    <p>— The Pixsolve Team</p>
  </body>
  </html>
  `;

  return sendEmail({
    to,
    subject: "Verify your email address",
    text,
    html
  });
};