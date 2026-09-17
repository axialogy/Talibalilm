'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { ActionError } from '@/components/admin/ActionError';
import { correctOrder } from '@/app/actions/office';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * Swapping a wrongly bought access for the right one.
 *
 * The office picks which access to replace — usually the only one — and what
 * it should have been. The money is untouched: this is a correction of the
 * door, not of the price, and the replacement keeps the days that were left.
 */
export function CorrectOrderForm({
  orderId,
  granted,
  targets,
}: {
  orderId: string;
  granted: { id: string; label: string }[];
  targets: { value: string; label: string }[];
}) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(correctOrder, EMPTY);

  if (granted.length === 0 || targets.length === 0) return null;

  const select =
    'w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400';

  return (
    <form action={action} className="rounded-[var(--radius-card)] border border-line bg-white p-5">
      <input type="hidden" name="orderId" value={orderId} />

      <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <Wrench className="size-4 text-ink-muted" aria-hidden="true" />
        {t('correctTitle')}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{t('correctLead')}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">
            {t('correctFrom')}
          </span>
          <select name="entitlementId" className={select} defaultValue={granted[0]?.id ?? ''}>
            {granted.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('correctTo')}</span>
          <select name="target" className={select} defaultValue={targets[0]?.value ?? ''}>
            {targets.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3">
        <Field label={t('grantReason')} name="reason" required maxLength={500} />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm">
          {t('correctCta')}
        </Button>
        {state.ok && !state.error && (
          <span role="status" className="text-[11px] text-brand-600">
            {t('saved')}
          </span>
        )}
        <ActionError state={state} />
      </div>
    </form>
  );
}
