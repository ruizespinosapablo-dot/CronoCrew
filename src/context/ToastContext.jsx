import { createContext, useContext, useState, useCallback } from 'react';

const ToastCtx = createContext(null);

const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
const COLORS = {
  success: { bg: 'rgba(45,212,191,.13)', border: 'rgba(45,212,191,.5)', color: 'var(--teal)' },
  error:   { bg: 'rgba(255,107,71,.13)', border: 'rgba(255,107,71,.5)', color: 'var(--coral)' },
  warning: { bg: 'rgba(251,191,36,.13)', border: 'rgba(251,191,36,.5)', color: 'var(--amber)' },
  info:    { bg: 'var(--bg3)',           border: 'var(--border3)',       color: 'var(--text2)' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 9999, pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type] || COLORS.info;
          return (
            <div key={t.id} className="toast-item" style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 10, padding: '10px 14px 10px 12px',
              fontSize: 13, maxWidth: 360, minWidth: 220,
              boxShadow: '0 4px 24px rgba(0,0,0,.45)',
              display: 'flex', alignItems: 'flex-start', gap: 9,
              pointerEvents: 'all', cursor: 'pointer',
            }} onClick={() => dismiss(t.id)}>
              <span style={{ color: c.color, fontWeight: 700, fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>
                {ICONS[t.type]}
              </span>
              <span style={{ color: 'var(--text)', lineHeight: 1.5 }}>{t.msg}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastCtx);
  // Fallback para cuando se usa fuera del provider (p.ej. AppContext antes de montar)
  if (!ctx) return { showToast: (msg, type) => console.warn('[Toast]', type, msg) };
  return ctx;
};
