'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { anonymiseStudent } from '@/app/actions/office';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * Erase a student on request (GDPR).
 *
 * Irreversible, so it asks twice: a typed reason for the audit trail, then a
 * confirmation naming the consequence. Both must pass before the form posts;
 * the RPC refuses an empty reason regardless, so a dismissed prompt is a no-op.
 */
export function AnonymiseButton({ userId }: { userId: string }) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(anonymiseStudent, EMPTY);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const form = event.currentTarget;
        const reason = window.prompt(t('anonymiseReasonPrompt'));
        if (!reason || reason.trim().length < 3) {
          event.preventDefault();
          return;
        }
        if (!window.confirm(t('anonymiseConfirm'))) {
          event.preventDefault();
          return;
        }
        (form.elements.namedItem('reason') as HTMLInputElement).value = reason;
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="reason" value="" />
      <Button type="submit" size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
        {t('anonymise')}
      </Button>
      {state.error && (
        <p role="alert" className="mt-2 text-[12px] text-red-600">
          {t(`errors.${state.error}` as 'errors.saveFailed')}
        </p>
      )}
    </form>
  );
}
