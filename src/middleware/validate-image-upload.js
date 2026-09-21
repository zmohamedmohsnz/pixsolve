import { fileTypeFromBuffer } from 'file-type';
import AppError from '../errors/api-error.js';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const validateImageUpload = async (req, _res, next) => {
  if (!req.file) {
    throw new AppError('An image file is required', 400, {
      code: 'IMAGE_REQUIRED'
    });
  }

  // it doesn't check the whole file to get the type. it only
  // checks specific bytes in the file that identify its format,
  // often called magic numbers or file signature.
  const fileType = await fileTypeFromBuffer(req.file.buffer);

  if (!fileType || !ALLOWED_IMAGE_MIME_TYPES.has(fileType.mime)) {
    throw new AppError('Only JPEG, PNG, and WebP images are supported.', 415, {
      code: 'UNSUPPORTED_IMAGE_TYPE'
    });
  }

  return next();
};