// ─── Import Modules ─────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import cloudinary from '../config/cloudinary.js';
import StorageError from '../errors/storage-error.js';

// ─── Constants ──────────────────────────────────────────────────────────────────

// public_id prefixes
const ORIGINALS_PREFIX = 'pixsolve/originals';
const PROCESSED_PREFIX = 'pixsolve/processed';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const rejectUpload = (reject, rawError) => {
  // we don't mention Cloudinary to don't make error
  // messages tied to specific storage provider.
  reject(new StorageError(
    'failed to upload image',
    'STORAGE_UPLOAD_FAILED',
    { cause: rawError }
  ));
};

// ─── Upload Image ───────────────────────────────────────────────────────────────

const uploadImage = (prefix, imageBuffer) => {
  // in our app, we've chosen `Buffer` as the standard representation
  // for images, so we use `upload_stream()` that expects `Buffer`,
  // so we check that the incoming image is Buffer.
  if (!Buffer.isBuffer(imageBuffer)) {
    throw new TypeError('Image must be provided as a Buffer');
  }

  return new Promise((resolve, reject) => {
    try {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          // generate it manually to control naming and folder organization.
          public_id: `${prefix}/${randomUUID()}`,

          // when `public_id` is already existed, the upload is rejected
          // and an error is thrown, that indicates an asset is already exist.
          // this is extra safety as we generate ID randomly so
          // two assets have the same ID, is extremely unlikely.
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            rejectUpload(reject, error);
            return;
          }

          if (!result?.public_id || !result?.secure_url) {
            reject(new StorageError(
              'Storage provider returned incomplete image metadata',
              'STORAGE_INVALID_RESPONSE'
            ));

            return;
          }

          resolve(result);
        }
      );

      // above, we handled "Cloudinary upload/API errors", while 'error'
      // event is emitted when a stream-level error is happened.
      uploadStream.once('error', error => { rejectUpload(reject, error); });

      // actually start sending the image buffer to Cloudinary
      uploadStream.end(imageBuffer);
    } catch (error) {
      rejectUpload(reject, error);
    }
  });
};

export const uploadOriginalImage = imageBuffer => {
  return uploadImage(ORIGINALS_PREFIX, imageBuffer);
};

export const uploadProcessedImage = imageBuffer => {
  return uploadImage(PROCESSED_PREFIX, imageBuffer);
};

// ─── Retrieve Image ─────────────────────────────────────────────────────────────

export const downloadImage = async (secureUrl) => {
  if (typeof secureUrl !== 'string' || secureUrl.trim() === '') {
    throw new TypeError('URL must be a non-empty string');
  }

  try {
    const response = await fetch(secureUrl);

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    // `arrayBuffer` reads binary data from the response body.
    const imageData = await response.arrayBuffer();

    // `arrayBuffer` is JS standard, `Buffer` is Node.js standard
    // so convert to `Buffer` which is more convenient in Node.js.
    return Buffer.from(imageData);

  } catch (error) {
    throw new StorageError(
      'Failed to download image',
      'STORAGE_DOWNLOAD_FAILED',
      { cause: error }
    );    
  }
};

// ─── Delete Image ───────────────────────────────────────────────────────────────

export const deleteImage = async (publicId) => {
  if (typeof publicId !== 'string' || publicId.trim() === '') {
    throw new TypeError('publicId must be a non-empty string');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      // removes also cache copies of the removed image if exist.
      invalidate: true
    });

    if (!['ok', 'not found'].includes(result?.result)) {
      throw new Error(`Unexpected delete result: ${result?.result}`);
    }

  } catch (error) {
    throw new StorageError(
      'Failed to delete image',
      'STORAGE_DELETE_FAILED',
      { cause: error }
    );
  }
};