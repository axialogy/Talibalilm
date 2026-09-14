'use client';

import { useTranslations } from 'next-intl';
import type { AdminState } from '@/app/actions/admin';

/**
 * How a failed admin action is reported: the sentence AND the evidence.
 *
 * The sentence is our diagnosis of what went wrong. `detail` is what the
 * database actually said. They are not the same thing, and for days they
 * disagreed on the coupon screen without anybody being able to tell — because
 * only the diagnosis was rendered and the evidence went to a server log.
 *
 * One component rather than the same six lines in twenty files. That is not
 * tidiness: twenty hand-written copies is how one gets missed, and the missed
 * one is always the screen that fails next.
 *
 * The `<pre>` is deliberate. A Postgres error carries its own line breaks and
 * a function signature that must not be re-wrapped into nonsense — it is the
 * argument list that identifies a mismatch, so it has to survive being read.
 */
export function ActionError({
  state,
  className = '',
}: {
  state: Pick<AdminState, 'error' | 'detail'>;
  /** Spacing, since callers place this in forms with different rhythms. */
  className?: string;
}) {
  const t = useTranslations('admin');
  if (!state.error) return null;

  return (
    <div className={className || 'mt-2'}>
      <p role="alert" className="text-[12px] text-red-600">
        {t(`errors.${state.error}` as 'errors.saveFailed')}
      </p>
      {state.detail && (
        <pre className="mt-2 overflow-x-auto rounded-[var(--radius-input)] border border-red-200 bg-red-50/60 p-3 text-[11px] leading-relaxed break-words whitespace-pre-wrap text-red-900">
          {state.detail}
        </pre>
      )}
    </div>
  );
}
