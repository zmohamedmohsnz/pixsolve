import { Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { RequireAuth } from './components/RequireAuth';
import { HomePage } from './pages/HomePage';
import { JobPage } from './pages/JobPage';
import { SignupPage } from './pages/SignupPage';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { UpdatePasswordPage } from './pages/UpdatePasswordPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return <><div className="pixel-field" aria-hidden="true" /><Header /><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/jobs/:jobId" element={<JobPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/verify-email" element={<EmailVerificationPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/update-password" element={<RequireAuth><UpdatePasswordPage /></RequireAuth>} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></>;
}
