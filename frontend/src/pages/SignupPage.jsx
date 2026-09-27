import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthForm, FormField } from '../components/AuthForm';
import { signup } from '../features/auth/auth-api';
import { apiFieldErrors, validateEmail, validatePassword } from '../features/auth/validation';

export const SignupPage = () => {
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const update = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async event => {
    event.preventDefault();
    const nextErrors = {
      name: values.name.trim().length < 2 ? 'Name must be at least 2 characters.' : values.name.trim().length > 100 ? 'Name must be at most 100 characters.' : '',
      email: validateEmail(values.email),
      password: validatePassword(values.password),
      confirmPassword: values.password !== values.confirmPassword ? 'Passwords don’t match.' : ''
    };
    setErrors(nextErrors);
    setApiError('');
    if (Object.values(nextErrors).some(Boolean)) return;
    setIsSubmitting(true);
    try {
      await signup({ ...values, name: values.name.trim(), email: values.email.trim() });
      setIsComplete(true);
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setApiError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) return <AuthForm title="Check your inbox" description="We sent a verification link to the email address you provided."><div className="auth-success"><strong>Your account is ready to verify.</strong><p>Open the link in your email, then return here to sign in. Check your spam folder if it does not arrive shortly.</p><Link className="process-button pixel-corners action-link" to="/login">Go to sign in</Link></div></AuthForm>;

  return <AuthForm title="Create your account" description="Create an account to keep your processed images in one place." error={apiError} footer={<>Already have an account? <Link to="/login">Sign in</Link></>}>
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormField label="Name" name="name" autoComplete="name" value={values.name} onChange={update} error={errors.name} />
      <FormField label="Email" name="email" type="email" autoComplete="email" value={values.email} onChange={update} error={errors.email} />
      <FormField label="Password" name="password" type="password" autoComplete="new-password" value={values.password} onChange={update} error={errors.password} />
      <FormField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={update} error={errors.confirmPassword} />
      <p className="password-help">Use 8–72 characters with uppercase, lowercase, a number, and a symbol.</p>
      <button className="process-button pixel-corners" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</button>
    </form>
  </AuthForm>;
};
