class StorageError extends Error {
  constructor(message, code, { cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });

    this.name = new.target.name;
    this.code = code;
  }
}

export default StorageError;