import mongoose from "mongoose";
import multer from 'multer';
import AppError from "../errors/AppError.js";

// cast errors happen when a value can't be
// converted to the type required by the schema.
const translateCastError = (error) => {
  return new AppError(`Invalid value for ${error.path}`, 400, {
    code: 'INVALID_VALUE',
    cause: error
  });
};

// duplicate key errors happen when
// a write violates a unique index.
const translateDuplicateKeyError = (error) => {
  // multiple fields may come because of compound-index
  const fields = Object.keys(error.keyPattern ?? error.keyValue ?? {});

  return new AppError(`A resource with that value already exists`, 409, {
    code: 'DUPLICATE_VALUE',
    details: fields.length > 0 ? { fields } : undefined,
    cause: error
  });
};

// validation errors happen when input
// data doesn't satisfy the schema rules.
const translateValidationError = (error) => {
  const validationErrors = Object.values(error.errors).map(validationError => ({
    field: validationError.path,
    message: validationError.message
  }));

  return new AppError('Validation Error', 422, {
    code: 'VALIDATION_ERROR',
    details: { fields: validationErrors },
    cause: error
  });
};

// version errors happen when saving
// a doc uses an outdated version.
const translateVersionError = (error) => {
  return new AppError(`The resource was modified by another request`, 409, {
    code: 'VERSION_CONFLICT',
    cause: error
  });
};

// 'LIMIT_UNEXPECTED_FILE' error of multer happen when 
// a second file or a file under another field name is sent.
const translateMulterLimitUnexpectedFileError = (error) => {
  return new AppError(
    `Only one file is allowed, using the "image" field.`,
    400,
    {
      code: 'LIMIT_UNEXPECTED_FILE',
      cause: error
    }
  );
};

// 'LIMIT_FILE_SIZE' error of multer happen when
// the sent file exceed the configured size.
const translateMulterFileSizeError = (error) => {
  return new AppError('Image must not be larger than 5 MB.', 413, {
    code: 'IMAGE_TOO_LARGE',
    cause: error
  })
};

const translateError = (error) => {
  // this is already translated
  if (error instanceof AppError) return error;

  // when invalid JSON passed to express.json()
  if (error?.type === 'entity.parse.failed') {
    return new AppError(`Request body contains invalid JSON`, 400, {
      code: 'INVALID_JSON',
      cause: error
    });
  }

  // when request body exceeded the body-size limit
  if (error?.type === 'entity.too.large') {
    return new AppError(`Request body is too large`, 413, {
      code: 'PAYLOAD_TOO_LARGE',
      cause: error
    });
  }

  // database errors
  if (error instanceof mongoose.Error.ValidationError) return translateValidationError(error);
  if (error instanceof mongoose.Error.CastError) return translateCastError(error);
  if (error instanceof mongoose.Error.VersionError) return translateVersionError(error);
  if (error?.name === 'MongoServerError' && error.code === 11000) return translateDuplicateKeyError(error);

  // multer errors
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_UNEXPECTED_FILE') return translateMulterLimitUnexpectedFileError(error);
    if (error.code === 'LIMIT_FILE_SIZE') return translateMulterFileSizeError(error);
  }
    
  return null;
};

const errorHandler = (incomingError, _req, res, next) => {
  // send errors that happen after a response is sent to Express's
  // default error handler because our custom handler tries to
  // send another response which is not allowed while the default
  // error handler can handle this case by closing the connection.
  if (res.headersSent) {
    res.err = incomingError;
    return next(incomingError);
  }

  const error = translateError(incomingError);

  // logs unknown errors and expected server-side failures.
  // pino-http checks `res.err` automatically for
  // an error during the automatic request log.
  if (!error || error.statusCode >= 500) {
    res.err = incomingError;
  }

  // when error is `null`, means error is not instance of `AppError`
  if (!error) {
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    });
  }
  
  return res.status(error.statusCode).json({
    status: 'error',
    code: error.code,
    message: error.message,
    ...(error.details && { details: error.details })
  });
};

export default errorHandler;