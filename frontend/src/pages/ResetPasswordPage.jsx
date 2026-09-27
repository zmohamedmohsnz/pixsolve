import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthForm, FormField } from '../components/AuthForm';
import { resetPassword } from '../features/auth/auth-api';
import { apiFieldErrors, validatePassword } from '../features/auth/validation';

export const ResetPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.search).get('token'));
  const [values, setValues] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(token ? '' : 'This password-reset link is missing or invalid.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => { navigate('/reset-password', { replace: true }); }, [navigate]);
  const update = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async event => {
    event.preventDefault();
    if (!token) return;
    const nextErrors = { password: validatePassword(values.password), confirmPassword: values.password !== values.confirmPassword ? 'Passwords don’t match.' : '' };
    setErrors(nextErrors); setApiError('');
    if (Object.values(nextErrors).some(Boolean)) return;
    setIsSubmitting(true);
    try { await resetPassword({ token, ...values }); setIsComplete(true); }
    catch (error) { setErrors(apiFieldErrors(error)); setApiError(error.message); }
    finally { setIsSubmitting(false); }
  };

  if (isComplete) return <AuthForm title="Password reset" description="Your password has been updated. Sign in with your new password."><div className="auth-success"><Link className="process-button pixel-corners action-link" to="/login">Sign in</Link></div></AuthForm>;
  return <AuthForm title="Choose a new password" description="Set a strong password for your Pixsolve account." error={apiError} footer={<Link to="/login">Return to sign in</Link>}>
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormField label="New password" name="password" type="password" autoComplete="new-password" value={values.password} onChange={update} error={errors.password} disabled={!token} />
      <FormField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={update} error={errors.confirmPassword} disabled={!token} />
      <p className="password-help">Use 8–72 characters with uppercase, lowercase, a number, and a symbol.</p>
      <button className="process-button pixel-corners" disabled={!token || isSubmitting}>{isSubmitting ? 'Resetting password…' : 'Reset password'}</button>
    </form>
  </AuthForm>;
};
