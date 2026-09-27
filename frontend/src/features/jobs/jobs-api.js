import { apiRequest } from '../../lib/api';

const jobsPath = '/image-processing/jobs';

export const createGuestJob = ({ file, operation, options }) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('operation', operation);
  formData.append('options', JSON.stringify(options));

  return apiRequest(jobsPath, { method: 'POST', body: formData });
};

export const createAccountJob = ({ file, operation, options, token, signal }) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('operation', operation);
  formData.append('options', JSON.stringify(options));

  return apiRequest(jobsPath, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    signal
  });
};

export const getGuestJob = ({ id, credential, signal }) => apiRequest(`${jobsPath}/${id}`, {
  headers: { 'X-Guest-Access-Token': credential },
  signal
});

export const getAccountJob = ({ id, token, signal }) => apiRequest(`${jobsPath}/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
  signal
});

export const getProcessingHistory = ({ page, limit = 10, token, signal }) => apiRequest(
  `${jobsPath}?page=${page}&limit=${limit}`,
  { headers: { Authorization: `Bearer ${token}` }, signal }
);
