'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionError } from '@/components/admin/ActionError';
import { SaveButton } from '@/components/admin/SaveButton';
import { saveCursusYearPrice } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';
import { ActionForm } from '@/components/ui/action-form';

const IDLE: AdminState = { ok: false };

export interface CursusPrice {
  id: string;
  delivery: 'presentiel' | 'online';
  yearIndex: number;
  priceCents: number;
  durationDays: number;
  status: 'draft' | 'published' | 'archived';
}

function toEuros(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * What a cursus costs, one line per year.
 *
 * The mode is organisational: on site and online cost the same. Asking twice
 * invited the two figures to disagree — and the school was left to keep them
 * in step by hand. One input per year writes both product rows.
 */
export function CursusTariff({
  cursusId,
  yearCount,
  prices,
}: {
  cursusId: string;
  yearCount: number;
  prices: CursusPrice[];
}) {
  const t = useTranslations('admin');
  const [state, save] = useActionState(saveCursusYearPrice, IDLE);

  const field =
    'rounded-[var(--radius-input)] border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400';

  const years = Array.from({ length: yearCount }, (_, i) => i + 1);

  return (
    <div className="space-y-2">
      {years.map((year) => {
        // Either mode's row answers for the year — they are written together.
        const existing =
          prices.find((p) => p.yearIndex === year && p.status !== 'archived') ??
          prices.find((p) => p.yearIndex === year);

        return (
          <ActionForm
            key={year}
            action={save}
            className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white px-4 py-3 text-[13px]"
          >
            <input type="hidden" name="cursus_id" value={cursusId} />
            <input type="hidden" name="year_index" value={year} />
            <input type="hidden" name="duration_days" value={existing?.durationDays ?? 365} />

            <span className="min-w-24 font-medium text-ink">
              {t('yearIndex')} {year}
            </span>

            <span className="text-ink-muted">{t('deliveryBoth')}</span>

            <label className="flex items-center gap-2">
              <span className="text-ink-muted">{t('feePrice')}</span>
              <input
                name="price"
                defaultValue={existing ? toEuros(existing.priceCents) : ''}
                placeholder="900"
                inputMode="decimal"
                className={`${field} w-28`}
              />
            </label>

            <select name="status" defaultValue={existing?.status ?? 'published'} className={field}>
              <option value="published">{t('published')}</option>
              <option value="draft">{t('draft')}</option>
              <option value="archived">{t('archived')}</option>
            </select>

            <SaveButton
              state={state}
              label={existing ? t('save') : t('feeAdd')}
              size="sm"
              variant="ghost"
            />
          </ActionForm>
        );
      })}

      <ActionError state={state} />
    </div>
  );
}
