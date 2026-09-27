import { apiRequest } from '../../lib/api';

const authPath = '/auth';
const jsonRequest = (path, { method, body, token } = {}) => apiRequest(`${authPath}${path}`, {
  method,
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify(body),
  returnPayload: true
});

export const signup = body => jsonRequest('/signup', { method: 'POST', body });
export const login = body => jsonRequest('/login', { method: 'POST', body });
export const verifyEmail = token => jsonRequest('/verify-email', { method: 'POST', body: { token } });
export const forgotPassword = body => jsonRequest('/forgot-password', { method: 'POST', body });
export const resetPassword = body => jsonRequest('/reset-password', { method: 'PATCH', body });
export const updatePassword = ({ token, ...body }) => jsonRequest('/update-password', { method: 'PATCH', body, token });
