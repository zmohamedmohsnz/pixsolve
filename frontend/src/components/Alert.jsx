export const Alert = ({ children, tone = 'error', role = 'alert' }) => (
  <div className={`alert alert-${tone}`} role={role}>{children}</div>
);
