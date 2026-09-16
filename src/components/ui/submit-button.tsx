'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * A submit button that says it is working.
 *
 * Every form on the site posts to a Server Action, and a round trip to the
 * database is not instant. Without this, the page looked frozen between the
 * click and the answer and people clicked again. `useFormStatus` reports only
 * for the form this button is inside, which is why it is a component rather
 * than a prop.
 */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}
