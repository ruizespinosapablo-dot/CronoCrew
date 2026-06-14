import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

// Limpieza de service workers "zombie" de despliegues antiguos (podían dejar a
// Safari sirviendo una versión cacheada obsoleta → pantalla negra).
if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
  navigator.serviceWorker.getRegistrations()
    .then(rs => rs.forEach(r => r.unregister()))
    .catch(() => {});
}

// Si tras un nuevo deploy falla la carga de un módulo (el navegador tenía
// cacheada una referencia antigua), recargamos una vez para coger lo nuevo.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('ct_chunk_reload')) {
    sessionStorage.setItem('ct_chunk_reload', '1');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </ToastProvider>
  </StrictMode>
);
