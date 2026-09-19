'use client';

import { useEffect, type ReactNode } from 'react';

/**
 * The overlay card the payment dialogs use.
 *
 * Lifted from the admin's draft/publish dialog so the two cannot drift, and
 * small on purpose: a title, the message, and whatever buttons the caller
 * puts in. Escape closes it, and the backdrop is dimmed rather than clickable
 * — a payment result should be dismissed deliberately, not by a stray click.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-70 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-lifted">
        <p className="font-display text-lg font-semibold text-ink">{title}</p>
        <div className="mt-2 space-y-4 text-[13px] leading-relaxed text-ink-muted">{children}</div>
      </div>
    </div>
  );
}
