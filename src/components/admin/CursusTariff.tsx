'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { saveProduct } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

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
 * What a cursus costs, on one line per mode.
 *
 * It used to live on a separate price list next to every module price, which
 * meant the fee for a programme was three screens away from the programme —
 * and the same figures were read in two places that could disagree. One line
 * here, beside the thing it prices.
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
  const [state, save] = useActionState(saveProduct, EMPTY);

  const field =
    'rounded-[var(--radius-input)] border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400';

  const years = Array.from({ length: yearCount }, (_, i) => i + 1);
  const rows = years.flatMap((year) =>
    (['online', 'presentiel'] as const).map((delivery) => ({
      year,
      delivery,
      existing: prices.find((p) => p.delivery === delivery && p.yearIndex === year),
    })),
  );

  return (
    <div className="space-y-2">
      {rows.map(({ year, delivery, existing }) => (
        <form
          key={`${year}-${delivery}`}
          action={save}
          className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white px-4 py-3 text-[13px]"
        >
          {existing && <input type="hidden" name="id" value={existing.id} />}
          <input type="hidden" name="kind" value="cursus" />
          <input type="hidden" name="cursus_id" value={cursusId} />
          <input type="hidden" name="delivery" value={delivery} />
          <input type="hidden" name="year_index" value={year} />
          <input type="hidden" name="duration_days" value={existing?.durationDays ?? 365} />

          <span className="min-w-40 font-medium text-ink">
            {yearCount > 1 && `${t('yearIndex')} ${year} · `}
            {delivery === 'online' ? t('deliveryOnline') : t('deliveryPresentiel')}
          </span>

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

          <Button type="submit" size="sm" variant="ghost">
            {existing ? t('save') : t('feeAdd')}
          </Button>
        </form>
      ))}

      {state.error && (
        <p role="alert" className="text-[12px] text-red-600">
          {t(`errors.${state.error}` as 'errors.saveFailed')}
        </p>
      )}
    </div>
  );
}
