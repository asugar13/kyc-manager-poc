import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import { QueuePage } from './pages/QueuePage';
import { CasePage } from './pages/CasePage';

export function App() {
  const [reviewer, setReviewer] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .currentUser()
      .then((name) => {
        if (!cancelled) setReviewer(name);
      })
      .catch(() => {
        // header still renders; pages surface their own load errors
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">K</span>
          <span>
            KYC Review Queue <span className="brand-sub">Compliance Ops · synthetic data · code app</span>
          </span>
        </Link>
        <span className="reviewer-picker">
          Signed in as <strong>{reviewer || '…'}</strong>
        </span>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<QueuePage />} />
          <Route path="/cases/:id" element={<CasePage reviewer={reviewer} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
