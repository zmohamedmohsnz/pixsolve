import { apiRequest } from '../../lib/api';

const jobsPath = '/image-processing/jobs';

export const createGuestJob = ({ file, operation, options }) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('operation', operation);
  formData.append('options', JSON.stringify(options));

  return apiRequest(jobsPath, { method: 'POST', body: formData });
};

export const getGuestJob = ({ id, credential, signal }) => apiRequest(`${jobsPath}/${id}`, {
  headers: { 'X-Guest-Access-Token': credential },
  signal
});
