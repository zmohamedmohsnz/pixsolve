import { useCallback } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
import { getGuestJob as getStoredGuestJob } from '../features/jobs/guest-job-storage';
import { useJobPolling } from '../features/jobs/use-job-polling';
import { useAuth } from '../features/auth/auth-context';

const jobDescription = job => {
  if (job.operation === 'resize') return `${job.options.width} × ${job.options.height} px`;
  if (job.operation === 'compress') return `Quality ${job.options.quality}`;
  return `Convert to ${job.options.format.toUpperCase()}`;
};

const downloadUrl = deliveryUrl => {
  try {
    const url = new URL(deliveryUrl);
    const pathParts = url.pathname.split('/');
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex !== -1 && pathParts[uploadIndex + 1] !== 'fl_attachment') pathParts.splice(uploadIndex + 1, 0, 'fl_attachment');
    url.pathname = pathParts.join('/');
    return url.toString();
  } catch {
    return deliveryUrl;
  }
};

export const JobPage = () => {
  const { jobId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { clearSession, session } = useAuth();
  const access = getStoredGuestJob();
  const hasAccess = access?.id === jobId;
  const token = !hasAccess ? session?.accessToken : null;
  const accountAccess = !hasAccess && Boolean(token);
  const handleAuthenticationLost = useCallback(() => {
    clearSession({ expired: true });
    navigate('/login', { replace: true, state: { from: { pathname: `/jobs/${jobId}` } } });
  }, [clearSession, jobId, navigate]);
  const { job, error, networkNotice } = useJobPolling({
    id: hasAccess || accountAccess ? jobId : null,
    credential: hasAccess ? access.credential : null,
    token,
    initialJob: location.state?.accessMode === (hasAccess ? 'guest' : 'account') ? location.state?.job : null,
    onAuthenticationLost: handleAuthenticationLost
  });

  if (!hasAccess && !accountAccess) return <main className="narrow-page"><section className="job-card panel pixel-corners"><h1>This job is not available here</h1><Alert>Sign in to view an account job, or use the browser session that created this guest job.</Alert><Link className="process-button pixel-corners action-link" to="/login">Sign in</Link><Link className="secondary-link" to="/">Process another image</Link></section></main>;
  if (error) return <main className="narrow-page"><section className="job-card panel pixel-corners"><h1>We couldn’t retrieve this job</h1><Alert>{error.message}</Alert><Link className="secondary-link" to="/">Process another image</Link></section></main>;

  return <main className="narrow-page"><section className="job-card panel pixel-corners">
    <p className="eyebrow">{hasAccess ? 'Guest image-processing job' : 'Account image-processing job'}</p>
    <div className="job-heading"><div><h1>{job ? `${job.operation[0].toUpperCase() + job.operation.slice(1)} image` : 'Loading job…'}</h1><p>{job && jobDescription(job)}</p></div>{job && <StatusBadge status={job.status} />}</div>
    {networkNotice && <Alert tone="info" role="status">{networkNotice}</Alert>}
    {!job && <p className="loading-copy">Checking your job status…</p>}
    {job?.status === 'pending' && <div className="job-state"><span className="spinner" aria-hidden="true" />Your image is waiting to be processed.</div>}
    {job?.status === 'processing' && <div className="job-state"><span className="spinner" aria-hidden="true" />Your image is being processed.</div>}
    {job?.status === 'completed' && <div className="job-state success-state"><strong>Your image is ready.</strong><a className="process-button pixel-corners action-link" href={downloadUrl(job.result.downloadUrl)}>Download result <span>↓</span></a></div>}
    {job?.status === 'failed' && <div className="job-state failed-state"><Alert>{job.error?.message || 'Image processing failed.'}</Alert><Link className="secondary-link" to="/">Try another image</Link></div>}
    <p className="job-note">Status updates automatically while this page is open.</p>
  </section></main>;
};
