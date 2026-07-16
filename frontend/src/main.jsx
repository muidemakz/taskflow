import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { applyTheme, getStoredTheme } from './utils/theme';
import './index.css';

// Applied before the first paint so there's no flash of the wrong theme
// while App.jsx waits on hydrate() to confirm the server-side preference.
applyTheme(getStoredTheme());

// import.meta.env.PROD is Vite's equivalent of process.env.NODE_ENV ===
// 'production' -- this project has no NODE_ENV convention since Vite never
// sets it at runtime in the browser bundle.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" />
    </BrowserRouter>
  </React.StrictMode>
);
