import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// When built with VITE_STATIC_MODE=true (GitHub Pages), load the read-only app.
const isStatic = import.meta.env.VITE_STATIC_MODE === 'true';

// Dynamic import keeps the two app trees fully tree-shaken from each other.
const Root = isStatic
  ? React.lazy(() => import('./AppReadOnly.jsx'))
  : React.lazy(() => import('./App.jsx'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={<div className="loading">Loading…</div>}>
      <Root />
    </React.Suspense>
  </React.StrictMode>
);
