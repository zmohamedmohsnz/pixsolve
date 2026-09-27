import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { getGuestJob } from './jobs-api';

const ACTIVE_STATUSES = new Set(['pending', 'processing']);
const retryDelays = [5000, 10000, 20000];

export const useJobPolling = ({ id, credential, initialJob }) => {
  const [job, setJob] = useState(initialJob || null);
  const [error, setError] = useState(null);
  const [networkNotice, setNetworkNotice] = useState(null);

  useEffect(() => {
    if (!id || !credential) return undefined;

    let cancelled = false;
    let timer;
    let retryAttempt = 0;
    let controller;

    const schedule = delay => {
      timer = window.setTimeout(loadJob, delay);
    };

    const loadJob = async () => {
      controller = new AbortController();
      try {
        const data = await getGuestJob({ id, credential, signal: controller.signal });
        if (cancelled) return;
        const nextJob = data.job;
        setJob(nextJob);
        setError(null);
        setNetworkNotice(null);
        retryAttempt = 0;
        if (ACTIVE_STATUSES.has(nextJob.status)) schedule(2000);
      } catch (requestError) {
        if (cancelled || requestError.name === 'AbortError') return;
        if (requestError instanceof ApiError && requestError.isNetwork) {
          const delay = retryDelays[Math.min(retryAttempt, retryDelays.length - 1)];
          retryAttempt += 1;
          setNetworkNotice(`Connection interrupted. Retrying in ${delay / 1000} seconds…`);
          schedule(delay);
          return;
        }
        setError(requestError);
      }
    };

    loadJob();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller?.abort();
    };
  }, [id, credential]);

  return { job, error, networkNotice };
};
