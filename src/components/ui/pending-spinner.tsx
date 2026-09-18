'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActionPending } from '@/components/ui/action-form';

/**
 * The in-flight mark for a button that is not a `<Button>`.
 *
 * The checkout's choice cards are submit buttons with their own layout, so
 * they cannot use `SubmitButton` — but they are exactly the buttons that take
 * a round trip to answer. This renders inside one and reports the same pending
 * state, from an ActionForm's transition or from `useFormStatus`, so a click
 * is visibly acknowledged everywhere.
 */
export function PendingSpinner({ className }: { className?: string }) {
  const dispatched = useActionPending();
  const { pending } = useFormStatus();
  if (!dispatched && !pending) return null;

  return (
    <Loader2 className={cn('size-4 shrink-0 animate-spin', className)} aria-hidden="true" />
  );
}
