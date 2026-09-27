const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { code, details, status, isNetwork = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
    this.isNetwork = isNetwork;
  }
}

export const apiRequest = async (path, options = {}) => {
  const { returnPayload = false, ...requestOptions } = options;
  let response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, requestOptions);
  } catch {
    throw new ApiError('Unable to reach Pixsolve. Check your connection and try again.', {
      isNetwork: true
    });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // The API's normal error shape is JSON; retain a useful fallback if a proxy fails first.
  }

  if (!response.ok) {
    throw new ApiError(payload?.message || 'Something went wrong. Please try again.', {
      code: payload?.code,
      details: payload?.details,
      status: response.status
    });
  }

  return returnPayload ? payload : payload?.data;
};
