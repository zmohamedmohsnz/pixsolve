import { Link } from 'react-router-dom';

export const Header = () => (
  <header className="site-header">
    <Link className="brand" to="/" aria-label="Pixsolve home"><img src="/pixsolve-logo.png" alt="Pixsolve" /></Link>
    <nav aria-label="Account navigation">
      <Link to="/login"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>Sign in</Link>
      <Link className="account-button pixel-corners" to="/signup">Create account</Link>
    </nav>
  </header>
);
