import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../features/auth/auth-context';
import { getProcessingHistory } from '../features/jobs/jobs-api';

const PAGE_SIZE = 10;
const jobSummary = job => job.operation === 'resize'
  ? `${job.options.width} × ${job.options.height} px`
  : job.operation === 'compress' ? `Quality ${job.options.quality}` : `Convert to ${job.options.format.toUpperCase()}`;
const formatTimestamp = timestamp => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));

export const HistoryPage = () => {
  const navigate = useNavigate();
  const { clearSession, session } = useAuth();
  const token = session?.accessToken;
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState(null);
  const [historyToken, setHistoryToken] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let current = true;
    const controller = new AbortController();
    setHistory(null); setError(null);
    getProcessingHistory({ page, limit: PAGE_SIZE, token, signal: controller.signal }).then(data => {
      if (current) { setHistory(data); setHistoryToken(token); }
    }).catch(requestError => {
      if (!current || requestError.name === 'AbortError') return;
      if (requestError.status === 401) {
        clearSession({ expired: true });
        navigate('/login', { replace: true, state: { from: { pathname: '/history' } } });
        return;
      }
      setError(requestError);
    });
    return () => { current = false; controller.abort(); };
  }, [page, token, clearSession, navigate]);

  const visibleHistory = historyToken === token ? history : null;
  const pagination = visibleHistory?.pagination;
  return <main className="history-page">
    <section className="history-heading"><div><p className="eyebrow">Account</p><h1>Processing history</h1><p>Your account’s image-processing jobs appear here.</p></div><Link className="account-button pixel-corners" to="/">Process an image</Link></section>
    {error && <Alert>{error.message}</Alert>}
    {!visibleHistory && !error && <section className="history-panel panel pixel-corners loading-history" aria-live="polite"><span className="spinner" aria-hidden="true" />Loading your processing history…</section>}
    {visibleHistory?.jobs.length === 0 && <section className="history-panel panel pixel-corners empty-history"><h2>No processing jobs yet</h2><p>Your account jobs will appear here after you process an image.</p><Link className="process-button pixel-corners action-link" to="/">Process your first image <span>→</span></Link></section>}
    {visibleHistory?.jobs.length > 0 && <section className="history-panel panel pixel-corners"><div className="history-list" aria-label="Processing jobs">
      {visibleHistory.jobs.map(job => <Link className="history-item" to={`/jobs/${job.id}`} state={{ job, accessMode: 'account' }} key={job.id}><div className="history-item-main"><strong>{job.operation[0].toUpperCase() + job.operation.slice(1)}</strong><span>{jobSummary(job)}</span><small>Created {formatTimestamp(job.createdAt)} · Updated {formatTimestamp(job.updatedAt)}</small></div><StatusBadge status={job.status} /><span className="history-item-arrow" aria-hidden="true">→</span></Link>)}
    </div>{pagination?.totalPages > 1 && <nav className="pagination" aria-label="History pagination"><button type="button" onClick={() => setPage(current => current - 1)} disabled={page === 1}>Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button type="button" onClick={() => setPage(current => current + 1)} disabled={page === pagination.totalPages}>Next</button></nav>}</section>}
  </main>;
};
