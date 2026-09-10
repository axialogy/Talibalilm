import type { ComponentProps, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * A labelled input with its error wired up.
 *
 * The error is bound through `aria-describedby` and `aria-invalid` rather than
 * only shown in red, so it reaches a screen reader — and the `id` is generated
 * so two fields with the same name on one page cannot collide.
 */
export function Field({
  label,
  error,
  hint,
  className,
  id: providedId,
  ...props
}: ComponentProps<'input'> & { label: string; error?: string | undefined; hint?: ReactNode }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={cn('block', className)}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
        className={cn(
          'w-full rounded-[var(--radius-input)] border bg-white px-4 py-2.5 text-sm text-ink outline-none transition-colors',
          'placeholder:text-ink-muted/60 focus:border-brand-400',
          error ? 'border-red-500' : 'border-line',
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[11px] text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
