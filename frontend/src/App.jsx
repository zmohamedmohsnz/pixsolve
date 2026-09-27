import { Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { JobPage } from './pages/JobPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return <><div className="pixel-field" aria-hidden="true" /><Header /><Routes><Route path="/" element={<HomePage />} /><Route path="/jobs/:jobId" element={<JobPage />} /><Route path="*" element={<NotFoundPage />} /></Routes></>;
}
