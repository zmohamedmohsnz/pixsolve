import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test, { afterEach, mock } from 'node:test';
import pino from 'pino';
import config from '../src/config/env.js';
import resend from '../src/config/resend.js';
import ApiError from '../src/errors/api-error.js';
import {
  sendEmail,
  sendFailedLoginNotificationEmail,
  sendPasswordUpdatedNotificationEmail,
  sendSuccessLoginNotificationEmail
} from '../src/services/email-service.js';

afterEach(() => {
  mock.restoreAll();
});

const message = {
  to: 'user@example.com',
  subject: 'Verify your PixSolve email',
  text: 'Use your verification link to finish signup.'
};

const assertSafeDeliveryError = (error, expectedCauseName, secrets = []) => {
  assert.ok(error instanceof ApiError);
  assert.equal(error.statusCode, 503);
  assert.equal(error.code, 'EMAIL_DELIVERY_FAILED');
  assert.equal(error.message, 'This email could not be sent.');
  assert.equal(error.details, undefined);
  assert.equal(error.cause?.message, expectedCauseName);

  // The HTTP error handler logs server errors through Pino.
  const loggedError = JSON.stringify(pino.stdSerializers.err(error));
  for (const secret of secrets) {
    assert.ok(!loggedError.includes(secret));
  }

  return true;
};

test('sends one authentication message through the configured provider', async () => {
  const sentMessages = [];

  mock.method(resend.emails, 'send', async payload => {
    sentMessages.push(payload);
    return { data: { id: 'email-test-id' }, error: null };
  });

  const result = await sendEmail(message);

  assert.equal(result, undefined);
  assert.deepEqual(sentMessages, [{
    from: config.email.fromEmail,
    to: message.to,
    subject: message.subject,
    text: message.text
  }]);
});

test('escapes request metadata in every notification HTML body', async () => {
  const sentMessages = [];
  const metadata = {
    ip: '127.0.0.1<script>',
    userAgent: '<img src="x" onerror="alert(\'x\')">&',
    time: '2026-09-26T12:00:00Z > now'
  };

  mock.method(resend.emails, 'send', async payload => {
    sentMessages.push(payload);
    return { data: { id: 'email-test-id' }, error: null };
  });

  for (const sendNotification of [
    sendSuccessLoginNotificationEmail,
    sendFailedLoginNotificationEmail,
    sendPasswordUpdatedNotificationEmail
  ]) {
    await sendNotification('user@example.com', metadata);
  }

  assert.equal(sentMessages.length, 3);

  for (const message of sentMessages) {
    assert.match(message.text, /<img src="x" onerror="alert\('x'\)">&/);
    assert.match(message.html, /&lt;img src=&quot;x&quot; onerror=&quot;alert\(&#39;x&#39;\)&quot;&gt;&amp;/);
    assert.doesNotMatch(message.html, /<img src=/);
    assert.match(message.html, /127\.0\.0\.1&lt;script&gt;/);
    assert.match(message.html, /2026-09-26T12:00:00Z &gt; now/);
  }
});

test('converts a returned Resend error to a sanitized application error', async () => {
  const secret = 'sensitive-verification-token';
  const credential = 'sensitive-provider-credential';

  mock.method(resend.emails, 'send', async () => ({
    data: null,
    error: {
      name: 'validation_error',
      statusCode: 403,
      message: `Provider details: ${secret} ${credential}`
    }
  }));

  await assert.rejects(
    sendEmail({ ...message, text: `Verification token: ${secret}` }),
    error => assertSafeDeliveryError(
      error,
      'validation_error',
      [secret, credential]
    )
  );
});

test('converts a thrown provider error without retaining its message', async () => {
  const secret = 'sensitive-reset-token';

  mock.method(resend.emails, 'send', async () => {
    const error = new Error(`Provider request failed with ${secret}`);
    error.name = 'ResendNetworkError';
    throw error;
  });

  await assert.rejects(
    sendEmail({ ...message, text: `Reset token: ${secret}` }),
    error => assertSafeDeliveryError(error, 'ResendNetworkError', [secret])
  );
});

test('rejects an incomplete provider success response', async () => {
  mock.method(resend.emails, 'send', async () => ({
    data: null,
    error: null
  }));

  await assert.rejects(
    sendEmail(message),
    error => assertSafeDeliveryError(error, 'unknown')
  );
});

const envModuleUrl = new URL('../src/config/env.js', import.meta.url).href;

for (const [name, value] of [
  ['RESEND_API_KEY', ''],
  ['RESEND_FROM_EMAIL', 'invalid-email']
]) {
  test(`rejects invalid ${name} in central configuration`, () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', `await import(${JSON.stringify(envModuleUrl)})`],
      {
        env: { ...process.env, [name]: value },
        encoding: 'utf8'
      }
    );

    const output = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 0);
    assert.match(output, new RegExp(name));
    assert.doesNotMatch(output, /test-resend-api-key/);
  });
}
