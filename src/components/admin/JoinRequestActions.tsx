'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionError } from '@/components/admin/ActionError';
import { decideJoinRequest } from '@/app/actions/live';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * The door controls: let one waiting student in, or turn them away.
 *
 * `live_decide_join` is the control — it checks the caller is the session's
 * host and writes the decision the classroom reads. The buttons only carry the
 * request id and a yes/no, so a hand-posted one cannot admit anybody the host
 * would not have.
 */
export function JoinRequestActions({ requestId }: { requestId: string }) {
  const t = useTranslations('admin');
  const [state, action, pending] = useActionState(decideJoinRequest, EMPTY);

  return (
    <div className="flex items-center gap-2">
      <form action={action}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="admit" value="yes" />
        <Button type="submit" size="sm" disabled={pending}>
          <Check className="size-3.5" aria-hidden="true" />
          {t('liveAdmit')}
        </Button>
      </form>

      <form action={action}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="admit" value="no" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          <X className="size-3.5" aria-hidden="true" />
          {t('liveRefuse')}
        </Button>
      </form>

      <ActionError state={state} />
    </div>
  );
}
