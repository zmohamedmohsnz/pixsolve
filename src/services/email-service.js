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