'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The in-flight mark for a button that is not a `<Button>`.
 *
 * The checkout's choice cards are submit buttons with their own layout, so
 * they cannot use `SubmitButton` — but they are exactly the buttons that take
 * a round trip to answer. This renders inside one and reports the same
 * `useFormStatus`, so a click is visibly acknowledged everywhere.
 */
export function PendingSpinner({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <Loader2 className={cn('size-4 shrink-0 animate-spin', className)} aria-hidden="true" />
  );
}
