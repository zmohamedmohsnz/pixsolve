// Why separating `StorageError` from `AppError` ?
// `StorageError` is an infrastructure error independent from
// HTTP concerns, so we don't want to expose it to clients.

// raw cloudinary error shouldn't be attached as `cause`, because pino
// could serialize it and unintentionally expose vendor details.

class StorageError extends Error {
  constructor(message, code) {
    super(message);

    this.name = new.target.name;
    this.code = code;
  }
}

export default StorageError;