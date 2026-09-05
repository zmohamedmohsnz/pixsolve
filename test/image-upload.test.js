import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import errorHandler from '../src/middleware/errorHandler.js';
import uploadSingleImage, { MAX_IMAGE_SIZE_MB } from '../src/middleware/image-upload.js';
import validateUploadedImage from '../src/middleware/validate-uploaded-image.js';

// real image files encoded as Base64
const JPEG_IMAGE = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==',
  'base64'
);

const PNG_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
  'base64'
);

const WEBP_IMAGE = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  'base64'
);

const VALID_IMAGE_CASES = [
  {
    format: 'JPEG',
    filename: 'test.jpg',
    contentType: 'image/jpeg',
    contents: JPEG_IMAGE
  },
  {
    format: 'PNG',
    filename: 'test.png',
    contentType: 'image/png',
    contents: PNG_IMAGE
  },
  {
    format: 'WebP',
    filename: 'test.webp',
    contentType: 'image/webp',
    contents: WEBP_IMAGE
  }
];


// creates an endpoint to test the both middleware
// `uploadSingleImage` and `validateUploadedImage`.
const createTestApp = () => {
  const app = express();

  app.post('/upload', uploadSingleImage, validateUploadedImage, (req, res) => {
    res.status(200).json({
      accepted: true,
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
    });
  });

  app.use(errorHandler);

  return app;
};

for (const imageCase of VALID_IMAGE_CASES) {
  test(`accepts a valid ${imageCase.format} image`, async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/upload')
      .attach('image', imageCase.contents, {
        filename: imageCase.filename,
        contentType: imageCase.contentType
      });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      accepted: true,
      fieldname: 'image',
      originalname: imageCase.filename
    });
  });
}

test('rejects a request with no image', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/upload');

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'IMAGE_REQUIRED',
    message: 'An image file is required.'
  });
});

test('accepts an image whose size is exactly 5 MB', async () => {
  const app = createTestApp();

  // calculate how many extra bytes we need to reach 5MB
  const remainingBytesToMaxSize = (MAX_IMAGE_SIZE_MB * 1024 * 1024) - PNG_IMAGE.length;

  // creates a new buffer with the original image plus empty bytes to reach max size
  const imageExactlyAtMaxSize = Buffer.concat([PNG_IMAGE, Buffer.alloc(remainingBytesToMaxSize)]);

  const response = await request(app)
    .post('/upload')
    .attach('image', imageExactlyAtMaxSize, {
      filename: 'at-limit.png',
      contentType: 'image/png'
    });
  
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    accepted: true,
    fieldname: 'image',
    originalname: 'at-limit.png'
  });
});

test('rejects an image larger than 5 MB', async () => {
  const app = createTestApp();

  // calculate how many extra bytes we need to reach 5MB
  const remainingBytesToMaxSize = (MAX_IMAGE_SIZE_MB * 1024 * 1024) - PNG_IMAGE.length;

  // creates a new buffer with the original image plus empty bytes to exceed max size
  const imageOverMaxSize = Buffer.concat([PNG_IMAGE, Buffer.alloc(remainingBytesToMaxSize + 1)]);

  const response = await request(app)
    .post('/upload')
    .attach('image', imageOverMaxSize, {
      filename: 'too-large.png',
      contentType: 'image/png'
    });

  assert.equal(response.status, 413);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'IMAGE_TOO_LARGE',
    message: 'Image must not be larger than 5 MB.'
  });
});

test('rejects an unsupported file type', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/upload')
    .attach('image', Buffer.from('This is not an image.'), {
      filename: 'fake.png',
      contentType: 'image/png'
    });

  assert.equal(response.status, 415);
  assert.deepEqual(response.body, {
    status: 'error',
    code: 'UNSUPPORTED_IMAGE_TYPE',
    message: 'Only JPEG, PNG, and WebP images are supported.'
  });
});

test('rejects multiple files uploaded through the image field', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/upload')
    .attach('image', PNG_IMAGE, {
      filename: 'first.png',
      contentType: 'image/png'
    })
    .attach('image', JPEG_IMAGE, {
      filename: 'second.jpg',
      contentType: 'image/jpeg'
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
    .attach('photo', PNG_IMAGE, {
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