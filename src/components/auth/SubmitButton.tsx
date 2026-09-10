'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * Disables itself while the action is in flight.
 *
 * `useFormStatus` only reports for the form this is *inside*, which is why it
 * is its own component rather than a prop threaded down from the form.
 */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block size="lg" disabled={pending} aria-busy={pending} {...props}>
      {children}
    </Button>
  );
}
