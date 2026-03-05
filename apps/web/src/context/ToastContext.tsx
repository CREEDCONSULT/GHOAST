'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timerRef.current[id]);
    delete timerRef.current[id];
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev.slice(-4), { id, message, variant }]);
      timerRef.current[id] = setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ── Toast stack UI ────────────────────────────────────────────────────────────

const ACCENT: Record<ToastVariant, string> = {
  success: 'var(--green)',
  error: 'var(--red)',
  warning: '#FFD166',
  info: 'var(--violet)',
};

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: 'var(--slate)',
            border: '1px solid rgba(123,79,255,.2)',
            borderLeft: `3px solid ${ACCENT[t.variant]}`,
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            animation: 'fadeUp .2s ease both',
            boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          }}
        >
          <span style={{ fontSize: 14, color: 'var(--ghost-text)', lineHeight: 1.4 }}>
            {t.message}
          </span>
          <button
            onClick={() => onDismiss(t.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              flexShrink: 0,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
