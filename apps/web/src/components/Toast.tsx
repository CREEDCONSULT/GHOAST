'use client';

/**
 * C-13 UndoToast + toast context. Live-region announcements (spec §21).
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { copy } from '@/lib/copy';

interface ToastData {
  id: number;
  message: string;
  onUndo?: () => void;
}

interface ToastContextValue {
  show: (message: string, onUndo?: () => void) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

const HOLD_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, onUndo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, onUndo });
    timer.current = setTimeout(() => setToast(null), HOLD_MS);
  }, []);

  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div aria-live="polite" role="status" className="caption" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
        {toast?.message ?? ''}
      </div>
      {toast && (
        <div className="toast" role="status">
          <span className="micro">{toast.message}</span>
          {toast.onUndo && (
            <button
              onClick={() => {
                toast.onUndo?.();
                dismiss();
              }}
            >
              {copy.review.undo}
            </button>
          )}
          <button aria-label={copy.a11y.close} onClick={dismiss} style={{ color: 'var(--text-3)' }}>
            ✕
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
