'use client';

/**
 * C-14 Sheet — scrimmed bottom sheet (mobile) / centered dialog (desktop).
 * Focus-trap + Escape handling for non-destructive sheets (spec §21).
 */

import { useEffect, useRef } from 'react';
import { copy } from '@/lib/copy';

interface SheetProps {
  open: boolean;
  title: string;
  onClose?: () => void; // omit for destructive/forced-choice sheets
  children: React.ReactNode;
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    el?.querySelector<HTMLElement>('button, [href], input')?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && onClose) onClose();
      if (e.key !== 'Tab' || !el) return;
      const focusables = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sheet-scrim"
      onClick={onClose ? (e) => e.target === e.currentTarget && onClose() : undefined}
    >
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="spread mb-4">
          <h2 style={{ margin: 0 }}>{title}</h2>
          {onClose && (
            <button className="btn-tertiary btn-sm" onClick={onClose} aria-label={copy.a11y.close}>
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
