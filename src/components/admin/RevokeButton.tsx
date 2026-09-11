'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { revokeEntitlement } from '@/app/actions/office';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * Revoke one entitlement, with a reason collected at the click.
 *
 * The reason is prompted in the browser and posted with the form. The RPC
 * refuses an empty one, so a mis-click that dismisses the prompt does nothing.
 */
export function RevokeButton({ entitlementId }: { entitlementId: string }) {
  const t = useTranslations('admin');
  const [, action] = useActionState(revokeEntitlement, EMPTY);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const reason = window.prompt(t('revokeReasonPrompt'));
        if (!reason || reason.trim().length < 3) {
          event.preventDefault();
          return;
        }
        (event.currentTarget.elements.namedItem('reason') as HTMLInputElement).value = reason;
      }}
    >
      <input type="hidden" name="entitlementId" value={entitlementId} />
      <input type="hidden" name="reason" value="" />
      <Button type="submit" size="sm" variant="ghost">
        {t('entRevoke')}
      </Button>
    </form>
  );
}
