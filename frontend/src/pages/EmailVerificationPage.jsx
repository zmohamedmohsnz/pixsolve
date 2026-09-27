import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { AuthForm } from '../components/AuthForm';
import { verifyEmail } from '../features/auth/auth-api';

export const EmailVerificationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.search).get('token'));
  const requestStarted = useRef(false);
  const [status, setStatus] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This verification link is missing or invalid.');

  useEffect(() => {
    navigate('/verify-email', { replace: true });
    if (!token || requestStarted.current) return undefined;
    requestStarted.current = true;
    verifyEmail(token)
      .then(response => { setStatus('success'); setMessage(response.message); })
      .catch(error => { setStatus('error'); setMessage(error.message); });
    return undefined;
  }, [navigate, token]);

  if (status === 'loading') return <AuthForm title="Verifying your email" description="Please wait while we confirm your email address."><p className="loading-copy">Verifying your link…</p></AuthForm>;
  if (status === 'success') return <AuthForm title="Email verified" description={message}><div className="auth-success"><Link className="process-button pixel-corners action-link" to="/login">Sign in</Link></div></AuthForm>;
  return <AuthForm title="We couldn’t verify your email"><Alert>{message}</Alert><div className="auth-success"><Link className="secondary-link" to="/login">Return to sign in</Link></div></AuthForm>;
};
