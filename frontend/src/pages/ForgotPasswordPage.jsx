import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthForm, FormField } from '../components/AuthForm';
import { forgotPassword } from '../features/auth/auth-api';
import { apiFieldErrors, validateEmail } from '../features/auth/validation';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const submit = async event => {
    event.preventDefault();
    const validationError = validateEmail(email);
    setError(validationError); setApiError('');
    if (validationError) return;
    setIsSubmitting(true);
    try { await forgotPassword({ email: email.trim() }); setIsComplete(true); }
    catch (requestError) { setError(apiFieldErrors(requestError).email || ''); setApiError(requestError.message); }
    finally { setIsSubmitting(false); }
  };

  if (isComplete) return <AuthForm title="Check your inbox" description="If that address belongs to an active account, we sent password-reset instructions."><div className="auth-success"><p>Open the link in the email to choose a new password. Check your spam folder if it does not arrive shortly.</p><Link className="secondary-link" to="/login">Return to sign in</Link></div></AuthForm>;
  return <AuthForm title="Reset your password" description="Enter your email address and we’ll send password-reset instructions." error={apiError} footer={<Link to="/login">Return to sign in</Link>}>
    <form className="auth-form" onSubmit={submit} noValidate><FormField label="Email" name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} error={error} /><button className="process-button pixel-corners" disabled={isSubmitting}>{isSubmitting ? 'Sending link…' : 'Send reset link'}</button></form>
  </AuthForm>;
};
