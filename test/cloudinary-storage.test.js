import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test, { afterEach, mock } from 'node:test';
import sharp from 'sharp';
import cloudinary from '../src/config/cloudinary.js';
import StorageError from '../src/errors/storage-error.js';
import {
  uploadOriginalImage,
  uploadProcessedImage,
  retrieveOriginalImage
} from '../src/services/storage.js';

afterEach(() => {
  mock.restoreAll();
});

const mockSuccessfulUpload = returnedMetadata => {
  let receivedOptions;
  let receivedBuffer;

  mock.method(
    cloudinary.uploader,
    'upload_stream',
    (options, callback) => {
      receivedOptions = options;

      return new Writable({
        write(chunk, _encoding, done) {
          receivedBuffer = Buffer.from(chunk);
          callback(null, returnedMetadata);
          done();
        }
      });
    }
  );

  return {
    getReceivedOptions: () => receivedOptions,
    getReceivedBuffer: () => receivedBuffer
  };
};

const uploadCases = [
  {
    name: 'original',
    upload: uploadOriginalImage,
    prefix: 'pixsolve/original'
  },
  {
    name: 'processed',
    upload: uploadProcessedImage,
    prefix: 'pixsolve/processed'
  }
];

for (const uploadCase of uploadCases) {
  test(`uploads the ${uploadCase.name} image buffer`, async () => {
    const publicId = `${uploadCase.prefix}/cloudinary-id`;
    const imageBuffer = Buffer.from(`${uploadCase.name}-image`);

    const uploadMock = mockSuccessfulUpload({
      public_id: publicId,
      secure_url:
        `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`,
      bytes: 100,
      format: 'jpg'
    });

    const result = await uploadCase.upload(imageBuffer);

    assert.deepEqual(result, {
      publicId,
      secureUrl:
        `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`
    });

    const options = uploadMock.getReceivedOptions();

    assert.equal(options.resource_type, 'image');
    assert.equal(options.type, 'upload');
    assert.equal(options.overwrite, false);
    assert.deepEqual(uploadMock.getReceivedBuffer(), imageBuffer);

    assert.match(
      options.public_id,
      new RegExp(
        `^${uploadCase.prefix}/[0-9a-f]{8}-` +
        '[0-9a-f]{4}-4[0-9a-f]{3}-' +
        '[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
    );
  });
}

test('propagates a sanitized Cloudinary upload failure', async () => {
  mock.method(
    cloudinary.uploader,
    'upload_stream',
    (_options, callback) => {
      return new Writable({
        write(_chunk, _encoding, done) {
          callback(new Error('Vendor error with internal details'));
          done();
        }
      });
    }
  );

  await assert.rejects(
    uploadOriginalImage(Buffer.from('image')),
    error => {
      assert.ok(error instanceof StorageError);
      assert.equal(error.code, 'STORAGE_UPLOAD_FAILED');
      assert.equal(error.message, 'Cloudinary image upload failed');
      assert.doesNotMatch(error.message, /internal details/);

      return true;
    }
  );
});

test('rejects incomplete metadata returned by Cloudinary', async () => {
  mockSuccessfulUpload({
    public_id: 'pixsolve/original/cloudinary-id'
  });

  await assert.rejects(
    uploadOriginalImage(Buffer.from('image')),
    {
      name: 'StorageError',
      code: 'STORAGE_INVALID_RESPONSE',
      message: 'Cloudinary returned incomplete image metadata'
    }
  );
});

test('propagates a sanitized upload stream failure', async () => {
  mock.method(
    cloudinary.uploader,
    'upload_stream',
    () => {
      return new Writable({
        write(_chunk, _encoding, done) {
          done(new Error('Stream error with internal details'));
        }
      });
    }
  );

  await assert.rejects(
    uploadOriginalImage(Buffer.from('image')),
    {
      name: 'StorageError',
      code: 'STORAGE_UPLOAD_FAILED',
      message: 'Cloudinary image upload failed'
    }
  );
});

test('retrieves an original image as a Sharp-readable buffer', async () => {
  const originalBuffer = await sharp({
    create: {
      width: 20,
      height: 10,
      channels: 3,
      background: { r: 30, g: 60, b: 90 }
    }
  })
    .jpeg()
    .toBuffer();

  const secureUrl =
    'https://res.cloudinary.com/test/image/upload/original.jpg';

  mock.method(globalThis, 'fetch', async receivedUrl => {
    assert.equal(receivedUrl, secureUrl);

    return new Response(originalBuffer, {
      status: 200,
      headers: {
        'content-type': 'image/jpeg'
      }
    });
  });

  const retrievedBuffer = await retrieveOriginalImage(secureUrl);
  const metadata = await sharp(retrievedBuffer).metadata();

  assert.ok(Buffer.isBuffer(retrievedBuffer));
  assert.equal(metadata.width, 20);
  assert.equal(metadata.height, 10);
  assert.equal(metadata.format, 'jpeg');
});

test('propagates a sanitized retrieval failure', async () => {
  mock.method(globalThis, 'fetch', async () => {
    return new Response(null, { status: 503 });
  });

  await assert.rejects(
    retrieveOriginalImage(
      'https://res.cloudinary.com/test/image/upload/original.jpg'
    ),
    {
      name: 'StorageError',
      code: 'STORAGE_RETRIEVAL_FAILED',
      message: 'Cloudinary original image retrieval failed'
    }
  );
});
