import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      setTimeout(() => removeToast(id), 3600);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast-item">
              {t.type === 'success' && <CheckCircle2 size={15} color="var(--status-positive)" />}
              {t.type === 'error' && <AlertCircle size={15} color="var(--status-live)" />}
              {t.type === 'info' && <Info size={15} color="var(--accent)" />}
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                style={{ width: 22, height: 22 }}
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: () => {} };
  return ctx;
}
