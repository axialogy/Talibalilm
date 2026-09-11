'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A labelled input with its error wired up.
 *
 * The error is bound through `aria-describedby` and `aria-invalid` rather than
 * only shown in red, so it reaches a screen reader — and the `id` is generated
 * so two fields with the same name on one page cannot collide.
 *
 * The error also CLEARS as soon as the field is edited. Without that, a form
 * action's state persists until the next submit, so someone correcting a typo
 * watches a red "this address is not valid" sit under an address that plainly
 * is — which reads as the site being broken rather than as stale feedback. The
 * server still re-validates on submit; this only stops the page insisting on a
 * verdict it can no longer support.
 */
export function Field({
  label,
  error,
  hint,
  className,
  id: providedId,
  onInput,
  ...props
}: ComponentProps<'input'> & { label: string; error?: string | undefined; hint?: ReactNode }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const [dismissed, setDismissed] = useState(false);

  // A new error from a fresh submit must show even if the last one was typed
  // away. Keyed on the message so an identical repeat still re-appears via the
  // reset below.
  useEffect(() => {
    setDismissed(false);
  }, [error]);

  const shown = error && !dismissed ? error : undefined;

  return (
    <div className={cn('block', className)}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={shown ? true : undefined}
        aria-describedby={cn(shown && errorId, hint && hintId) || undefined}
        onInput={(event) => {
          setDismissed(true);
          onInput?.(event);
        }}
        className={cn(
          'w-full rounded-[var(--radius-input)] border bg-white px-4 py-2.5 text-sm text-ink outline-none transition-colors',
          'placeholder:text-ink-muted/60 focus:border-brand-400',
          shown ? 'border-red-500' : 'border-line',
        )}
        {...props}
      />
      {hint && !shown && (
        <p id={hintId} className="mt-1.5 text-[11px] text-ink-muted">
          {hint}
        </p>
      )}
      {shown && (
        <p id={errorId} role="alert" className="mt-1.5 text-[11px] text-red-600">
          {shown}
        </p>
      )}
    </div>
  );
}
