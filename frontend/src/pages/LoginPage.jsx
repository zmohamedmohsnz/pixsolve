import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthForm, FormField } from '../components/AuthForm';
import { login } from '../features/auth/auth-api';
import { useAuth } from '../features/auth/auth-context';
import { apiFieldErrors, validateEmail } from '../features/auth/validation';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { establishSession } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(location.state?.notice || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const update = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async event => {
    event.preventDefault();
    const nextErrors = { email: validateEmail(values.email), password: values.password ? '' : 'Password is required.' };
    setErrors(nextErrors);
    setApiError('');
    if (Object.values(nextErrors).some(Boolean)) return;
    setIsSubmitting(true);
    try {
      const response = await login({ email: values.email.trim(), password: values.password });
      establishSession(response.data);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setApiError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return <AuthForm title="Welcome back" description="Sign in to access your Pixsolve account." error={apiError} footer={<>Need an account? <Link to="/signup">Create one</Link></>}>
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormField label="Email" name="email" type="email" autoComplete="email" value={values.email} onChange={update} error={errors.email} />
      <FormField label="Password" name="password" type="password" autoComplete="current-password" value={values.password} onChange={update} error={errors.password} />
      <Link className="inline-link" to="/forgot-password">Forgot your password?</Link>
      <button className="process-button pixel-corners" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </AuthForm>;
};
