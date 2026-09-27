import { Alert } from './Alert';

export const AuthForm = ({ title, description, error, children, footer }) => (
  <main className="auth-page">
    <section className="auth-card panel pixel-corners">
      <p className="eyebrow">Pixsolve account</p>
      <h1>{title}</h1>
      {description && <p className="auth-description">{description}</p>}
      {error && <Alert>{error}</Alert>}
      {children}
      {footer && <div className="auth-footer">{footer}</div>}
    </section>
  </main>
);

export const FormField = ({ label, error, ...inputProps }) => (
  <label className="form-field">
    <span>{label}</span>
    <input aria-invalid={Boolean(error)} {...inputProps} />
    {error && <small className="form-field-error" role="alert">{error}</small>}
  </label>
);
