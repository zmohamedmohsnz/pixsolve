import { randomUUID } from 'node:crypto';
import cloudinary from '../config/cloudinary.js';
import StorageError from '../errors/storage-error.js';

export const ORIGINAL_PUBLIC_ID_PREFIX = 'pixsolve/original';
export const PROCESSED_PUBLIC_ID_PREFIX = 'pixsolve/processed';

// check that a value is a valid image buffer
const assertImageBuffer = imageBuffer => {
  if (!Buffer.isBuffer(imageBuffer))
    throw new TypeError('Image must be provided as a Buffer');
};

const uploadImage = (imageBuffer, publicIdPrefix) => {
  assertImageBuffer(imageBuffer);

  // `upload_stream` works with callback so
  // we promisify it to can use async/await
  return new Promise((resolve, reject) => {
    const rejectUpload = () => {
      reject(new StorageError(
        'Cloudinary image upload failed',
        'STORAGE_UPLOAD_FAILED'
      ));
    };

    try {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          // tells cloudinary the file type (default: image)
          resource_type: 'image',
          // access mode (default: upload)
          type: 'upload',
          // generate the public id manually to follow specific form
          public_id: `${publicIdPrefix}/${randomUUID()}`,
          // refuse the upload if `public_id` already exist, and
          // return a response indicating that an asset is already exist.
          overwrite: false
        },

        (error, result) => {
          if (error) {
            rejectUpload();
            return;
          }

          if (!result?.public_id || !result?.secure_url) {
            reject(new StorageError(
              'Cloudinary returned incomplete image metadata',
              'STORAGE_INVALID_RESPONSE'
            ));

            return;
          }

          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url
          });
        }
      );

      // it says if stream itself throws an error, call `rejectUpload`
      uploadStream.once('error', rejectUpload);
      
      // this sends the image buffer into the stream to start uploading
      uploadStream.end(imageBuffer);
    } catch {
      rejectUpload();
    }
  });
};

export const uploadOriginalImage = imageBuffer => {
  return uploadImage(imageBuffer, ORIGINAL_PUBLIC_ID_PREFIX);
};

export const uploadProcessedImage = imageBuffer => {
  return uploadImage(imageBuffer, PROCESSED_PUBLIC_ID_PREFIX);
};

export const retrieveOriginalImage = async secureUrl => {
  if (typeof secureUrl !== 'string' || secureUrl.trim() === '') {
    throw new TypeError('Original image secureUrl must be a non-empty string');
  }

  try {
    const response = await fetch(secureUrl);

    if (!response.ok) {
      throw new StorageError(
        'Cloudinary original image retrieval failed',
        'STORAGE_RETRIEVAL_FAILED'
      );
    }

    const imageData = await response.arrayBuffer();
    return Buffer.from(imageData);

  } catch (error) {
    if (error instanceof StorageError) throw error;

    throw new StorageError(
      'Cloudinary original image retrieval failed',
      'STORAGE_RETRIEVAL_FAILED'
    );
  }
};