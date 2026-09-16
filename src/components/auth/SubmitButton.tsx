'use client';

import { SubmitButton as PendingButton } from '@/components/ui/submit-button';
import type { ButtonProps } from '@/components/ui/button';

/**
 * The auth forms' button: full width, large, and it spins while the action is
 * in flight. The spinner itself lives in `@/components/ui/submit-button` so
 * every form on the site reports the same way.
 */
export function SubmitButton({ children, ...props }: ButtonProps) {
  return (
    <PendingButton block size="lg" {...props}>
      {children}
    </PendingButton>
  );
}
