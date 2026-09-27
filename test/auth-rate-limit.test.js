import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('limits all auth routes after five requests in production mode', async () => {
  // The application intentionally bypasses the limiter under NODE_ENV=test so
  // independent auth tests do not share one loopback-IP quota. Run this check
  // in a clean production-mode process to exercise the real router middleware.
  const verificationProgram = `
    import assert from 'node:assert/strict';
    import express from 'express';
    import request from 'supertest';
    import authRouter from './src/routes/auth-routes.js';
    import errorHandler from './src/middleware/handle-errors.js';

    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRouter);
    app.use(errorHandler);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      assert.equal(response.status, 422);
    }

    const blockedResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({});

    assert.equal(blockedResponse.status, 429);
    assert.deepEqual(blockedResponse.body, {
      status: 'error',
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please try again later.'
    });
    assert.ok(blockedResponse.headers.ratelimit);
    assert.ok(blockedResponse.headers['retry-after']);
    assert.equal(blockedResponse.headers['x-ratelimit-limit'], undefined);
  `;

  await execFileAsync(
    process.execPath,
    ['--input-type=module', '--eval', verificationProgram],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    }
  );
});
