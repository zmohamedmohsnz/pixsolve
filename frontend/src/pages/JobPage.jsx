import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
import { getGuestJob as getStoredGuestJob } from '../features/jobs/guest-job-storage';
import { useJobPolling } from '../features/jobs/use-job-polling';

const jobDescription = job => {
  if (job.operation === 'resize') return `${job.options.width} × ${job.options.height} px`;
  if (job.operation === 'compress') return `Quality ${job.options.quality}`;
  return `Convert to ${job.options.format.toUpperCase()}`;
};

export const JobPage = () => {
  const { jobId } = useParams();
  const location = useLocation();
  const access = getStoredGuestJob();
  const hasAccess = access?.id === jobId;
  const { job, error, networkNotice } = useJobPolling({
    id: hasAccess ? jobId : null,
    credential: hasAccess ? access.credential : null,
    initialJob: location.state?.job
  });

  if (!hasAccess) return <main className="narrow-page"><section className="job-card panel pixel-corners"><h1>This job is not available here</h1><Alert>Its guest credential is only kept in the browser session that created it.</Alert><Link className="process-button pixel-corners action-link" to="/">Process another image</Link></section></main>;
  if (error) return <main className="narrow-page"><section className="job-card panel pixel-corners"><h1>We couldn’t retrieve this job</h1><Alert>{error.message}</Alert><Link className="secondary-link" to="/">Process another image</Link></section></main>;

  return <main className="narrow-page"><section className="job-card panel pixel-corners">
    <p className="eyebrow">Guest image-processing job</p>
    <div className="job-heading"><div><h1>{job ? `${job.operation[0].toUpperCase() + job.operation.slice(1)} image` : 'Loading job…'}</h1><p>{job && jobDescription(job)}</p></div>{job && <StatusBadge status={job.status} />}</div>
    {networkNotice && <Alert tone="info" role="status">{networkNotice}</Alert>}
    {!job && <p className="loading-copy">Checking your job status…</p>}
    {job?.status === 'pending' && <div className="job-state"><span className="spinner" aria-hidden="true" />Your image is waiting to be processed.</div>}
    {job?.status === 'processing' && <div className="job-state"><span className="spinner" aria-hidden="true" />Your image is being processed.</div>}
    {job?.status === 'completed' && <div className="job-state success-state"><strong>Your image is ready.</strong><a className="process-button pixel-corners action-link" href={job.result.downloadUrl}>Download result <span>↓</span></a></div>}
    {job?.status === 'failed' && <div className="job-state failed-state"><Alert>{job.error?.message || 'Image processing failed.'}</Alert><Link className="secondary-link" to="/">Try another image</Link></div>}
    <p className="job-note">Status updates automatically while this page is open.</p>
  </section></main>;
};
