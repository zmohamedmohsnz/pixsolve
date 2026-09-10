import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import config from '../src/config/env.js';
import cloudinary from '../src/config/cloudinary.js';

const envModuleUrl = new URL(
  '../src/config/env.js',
  import.meta.url
).href;

const cloudinaryVariables = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const validEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: '3000',
  DB_URI: 'mongodb://127.0.0.1:27017/pixsolve-test',
  REDIS_URL: 'redis://127.0.0.1:6379',
  CLOUDINARY_CLOUD_NAME: 'pixsolve-test',
  CLOUDINARY_API_KEY: 'test-api-key',
  CLOUDINARY_API_SECRET: 'test-api-secret'
};

test('configures the reusable Cloudinary client from central configuration', () => {
  const cloudinaryConfig = cloudinary.config();

  assert.equal(cloudinaryConfig.cloud_name, config.cloudinary.cloudName);
  assert.equal(cloudinaryConfig.api_key, config.cloudinary.apiKey);
  assert.equal(cloudinaryConfig.api_secret, config.cloudinary.apiSecret);
  assert.equal(cloudinaryConfig.secure, true);
});

for (const variableName of cloudinaryVariables) {
  test(`rejects missing ${variableName}`, () => {
    const environment = {
      ...validEnvironment,
      [variableName]: ''
    };

    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `await import(${JSON.stringify(envModuleUrl)})`
      ],
      {
        env: environment,
        encoding: 'utf8'
      }
    );

    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0);
    assert.match(output, new RegExp(`${variableName}.*required`));

    assert.doesNotMatch(output, /test-api-key/);
    assert.doesNotMatch(output, /test-api-secret/);
  });
}
