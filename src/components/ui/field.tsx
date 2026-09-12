'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A labelled input with its error wired up.
 *
 * The error is bound through `aria-describedby` and `aria-invalid` rather than
 * only shown in red, so it reaches a screen reader — and the `id` is generated
 * so two fields with the same name on one page cannot collide.
 *
 * A password field grows a reveal button on its own, without the call site
 * asking. Typing a password you cannot see is where most sign-in failures are
 * actually born — someone mistypes, gets "wrong password", and has no way to
 * find out which character they fumbled. Putting it here rather than in each
 * form means no password input can be added later that quietly lacks it.
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
  const t = useTranslations('auth');
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const [dismissed, setDismissed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const isPassword = props.type === 'password';
  // The browser must still autofill and save it, so the name and autoComplete
  // are untouched — only the rendered type changes while it is revealed.
  const type = isPassword && revealed ? 'text' : props.type;

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
      <div className="relative">
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
            // Room for the button, so a long password does not run under it.
            isPassword && 'pe-11',
            shown ? 'border-red-500' : 'border-line',
          )}
          {...props}
          type={type}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? t('hidePassword') : t('showPassword')}
            aria-pressed={revealed}
            // Not in the tab order: someone tabbing from the password field
            // expects the submit button, not a toggle. Still reachable by
            // pointer, and by screen readers through the form's controls.
            tabIndex={-1}
            className="absolute end-0 top-0 flex h-full items-center px-3.5 text-ink-muted transition-colors hover:text-brand-600"
          >
            {revealed ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
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
