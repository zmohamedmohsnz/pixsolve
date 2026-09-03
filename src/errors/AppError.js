class AppError extends Error {
  constructor(message, statusCode, {code, details, cause} = {}) {
    if (typeof message !== 'string' || message.trim() === '')
      throw new TypeError('Error message must be a non-empty string');

    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599)
      throw new TypeError(`Invalid status code of an error: ${statusCode}`);

    if (typeof code !== 'string' || code.trim() === '')
      throw new TypeError('Error code must be a non-empty string');

    super(message, cause === undefined ? undefined : { cause });

    // `new.target.name` returns the class name instead of hardcoding
    // 'AppError' and also to support names of future subclasses.
    this.name = new.target.name;

    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  } 
}

export default AppError;