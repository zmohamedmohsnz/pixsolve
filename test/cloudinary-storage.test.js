import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test, { afterEach, mock } from 'node:test';
import sharp from 'sharp';
import cloudinary from '../src/config/cloudinary.js';
import StorageError from '../src/errors/storage-error.js';
import {
  uploadOriginalImage,
  uploadProcessedImage,
  downloadImage,
  deleteImage
} from '../src/storage/cloudinary-storage.js';

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
    prefix: 'pixsolve/originals'
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

    const returnedMetadata = {
      public_id: publicId,
      secure_url:
        `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`,
      bytes: 100,
      format: 'jpg'
    };
    const uploadMock = mockSuccessfulUpload(returnedMetadata);

    const result = await uploadCase.upload(imageBuffer);

    assert.deepEqual(result, returnedMetadata);

    const options = uploadMock.getReceivedOptions();

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
      assert.equal(error.message, 'failed to upload image');
      assert.doesNotMatch(error.message, /internal details/);

      return true;
    }
  );
});

test('rejects incomplete metadata returned by Cloudinary', async () => {
  mockSuccessfulUpload({
    public_id: 'pixsolve/originals/cloudinary-id'
  });

  await assert.rejects(
    uploadOriginalImage(Buffer.from('image')),
    {
      name: 'StorageError',
      code: 'STORAGE_INVALID_RESPONSE',
      message: 'Storage provider returned incomplete image metadata'
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
      message: 'failed to upload image'
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

  const retrievedBuffer = await downloadImage(secureUrl);
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
    downloadImage(
      'https://res.cloudinary.com/test/image/upload/original.jpg'
    ),
    {
      name: 'StorageError',
      code: 'STORAGE_DOWNLOAD_FAILED',
      message: 'Failed to download image'
    }
  );
});

test('deletes an original image during creation compensation', async () => {
  const publicId = 'pixsolve/originals/creation-test';
  let receivedPublicId;
  let receivedOptions;

  mock.method(
    cloudinary.uploader,
    'destroy',
    async (requestedPublicId, options) => {
      receivedPublicId = requestedPublicId;
      receivedOptions = options;

      return { result: 'ok' };
    }
  );

  await deleteImage(publicId);

  assert.equal(receivedPublicId, publicId);
  assert.deepEqual(receivedOptions, { invalidate: true });
});

test('treats an already absent original image as deleted', async () => {
  mock.method(
    cloudinary.uploader,
    'destroy',
    async () => ({ result: 'not found' })
  );

  await assert.doesNotReject(
    deleteImage('pixsolve/originals/already-absent')
  );
});

test('propagates a sanitized original-image deletion failure', async () => {
  mock.method(
    cloudinary.uploader,
    'destroy',
    async () => {
      throw new Error('Vendor deletion failure with internal details');
    }
  );

  await assert.rejects(
    deleteImage('pixsolve/originals/creation-test'),
    error => {
      assert.ok(error instanceof StorageError);
      assert.equal(error.code, 'STORAGE_DELETE_FAILED');
      assert.equal(
        error.message,
        'Failed to delete image'
      );
      assert.doesNotMatch(error.message, /internal details/);

      return true;
    }
  );
});
