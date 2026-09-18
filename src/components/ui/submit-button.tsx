'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useActionPending } from '@/components/ui/action-form';

/**
 * A submit button that says it is working.
 *
 * Every form on the site posts to a Server Action, and a round trip to the
 * database is not instant. Without this, the page looked frozen between the
 * click and the answer and people clicked again. `useFormStatus` reports only
 * for the form this button is inside, which is why it is a component rather
 * than a prop.
 *
 * The context answers for an ActionForm, whose action is dispatched by hand
 * and is therefore invisible to `useFormStatus`. One of the two is always the
 * right reporter; a plain form leaves the context false.
 */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const dispatched = useActionPending();
  const { pending } = useFormStatus();
  const busy = dispatched || pending;

  return (
    <Button type="submit" disabled={busy} aria-busy={busy} {...props}>
      {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}
