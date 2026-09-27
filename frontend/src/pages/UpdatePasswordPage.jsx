import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthForm, FormField } from '../components/AuthForm';
import { updatePassword } from '../features/auth/auth-api';
import { useAuth } from '../features/auth/auth-context';
import { apiFieldErrors, validatePassword } from '../features/auth/validation';

export const UpdatePasswordPage = () => {
  const navigate = useNavigate();
  const { session, clearSession } = useAuth();
  const [values, setValues] = useState({ curPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const update = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async event => {
    event.preventDefault();
    const nextErrors = {
      curPassword: values.curPassword ? '' : 'Current password is required.',
      newPassword: values.curPassword === values.newPassword ? 'New password must be different from the current one.' : validatePassword(values.newPassword),
      confirmPassword: values.newPassword !== values.confirmPassword ? 'Passwords don’t match.' : ''
    };
    setErrors(nextErrors); setApiError('');
    if (Object.values(nextErrors).some(Boolean)) return;
    setIsSubmitting(true);
    try {
      await updatePassword({ token: session.accessToken, ...values });
      clearSession();
      navigate('/login', { replace: true, state: { notice: 'Password updated. Please sign in with your new password.' } });
    } catch (error) {
      if (error.code === 'INVALID_ACCESS_TOKEN' || error.code === 'PASSWORD_CHANGED') {
        clearSession();
        navigate('/login', { replace: true, state: { notice: 'Your session has expired. Please sign in again.' } });
        return;
      }
      setErrors(apiFieldErrors(error));
      setApiError(error.message);
    } finally { setIsSubmitting(false); }
  };
  return <AuthForm title="Update password" description="Changing your password signs you out on completion." error={apiError} footer={<Link to="/">Return to image processing</Link>}>
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormField label="Current password" name="curPassword" type="password" autoComplete="current-password" value={values.curPassword} onChange={update} error={errors.curPassword} />
      <FormField label="New password" name="newPassword" type="password" autoComplete="new-password" value={values.newPassword} onChange={update} error={errors.newPassword} />
      <FormField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={update} error={errors.confirmPassword} />
      <p className="password-help">Use 8–72 characters with uppercase, lowercase, a number, and a symbol.</p>
      <button className="process-button pixel-corners" disabled={isSubmitting}>{isSubmitting ? 'Updating password…' : 'Update password'}</button>
    </form>
  </AuthForm>;
};
