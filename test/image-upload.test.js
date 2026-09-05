import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import errorHandler from '../src/middleware/errorHandler.js';
import uploadSingleImage from '../src/middleware/image-upload.js';

// creates an endpoint to test the middleware
const createTestApp = () => {
  const app = express();

  app.post('/upload', uploadSingleImage, (req, res) => {
    res.status(200).json({
      fieldname: req.file?.fieldname,
      originalname: req.file?.originalname,
      contents: req.file?.buffer.toString('utf8')
    });
  });

  app.use(errorHandler);

  return app;
};

test('receives one file from the image multipart field', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/upload')
    .attach('image', Buffer.from('test image contents'), {
      filename: 'test.png',
      contentType: 'image/png'
    });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    fieldname: 'image',
    originalname: 'test.png',
    contents: 'test image contents'
  });
});

test('rejects multiple files uploaded through the image field', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/upload')
    .attach('image', Buffer.from('first image'), {
      filename: 'first.png',
      contentType: 'image/png'
    })
    .attach('image', Buffer.from('second image'), {
      filename: 'second.png',
      contentType: 'image/png'
    });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'LIMIT_UNEXPECTED_FILE',
    message: 'Only one file is allowed, using the "image" field.'
  });
});

test('rejects a file uploaded through an unexpected multipart field', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/upload')
    .attach('photo', Buffer.from('test image contents'), {
      filename: 'test.png',
      contentType: 'image/png'
    });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'LIMIT_UNEXPECTED_FILE',
    message: 'Only one file is allowed, using the "image" field.'
  });
});