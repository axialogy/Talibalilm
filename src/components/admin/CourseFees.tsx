'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteProduct, saveProduct } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

export interface CourseFee {
  id: string;
  delivery: 'presentiel' | 'online';
  priceCents: number;
  durationDays: number;
  status: 'draft' | 'published' | 'archived';
}

/** Cents back to what a person types: "300", "300.50". */
function toEuros(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * What this course costs, on the course's own page.
 *
 * The general price list asks which course, which kind of product, a time slot,
 * hours per week — everything, because it serves the whole catalogue. Here the
 * course is already known and the kind is always a module, so the teacher is
 * asked the only two things that vary: the mode and the price. Duration and
 * status carry sensible defaults and stay editable on the existing row.
 *
 * Zero is a real price. A course priced at nothing is published as free and the
 * checkout settles it without PayPal.
 */
export function CourseFees({ courseId, fees }: { courseId: string; fees: CourseFee[] }) {
  const t = useTranslations('admin');
  const [addState, add] = useActionState(saveProduct, EMPTY);
  const [, remove] = useActionState(deleteProduct, EMPTY);

  const field =
    'w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400';

  const taken = new Set(fees.map((f) => f.delivery));
  const free = (['presentiel', 'online'] as const).filter((d) => !taken.has(d));

  return (
    <div className="space-y-3">
      {fees.length > 0 && (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {fees.map((fee) => (
            <li key={fee.id} className="p-4">
              {/* Editing posts the whole row back, so the price and the mode it
                  belongs to can never drift apart. */}
              <form action={add} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={fee.id} />
                <input type="hidden" name="kind" value="module" />
                <input type="hidden" name="course_id" value={courseId} />

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-ink-muted">
                    {t('feeMode')}
                  </span>
                  <select name="delivery" defaultValue={fee.delivery} className={field}>
                    <option value="online">{t('deliveryOnline')}</option>
                    <option value="presentiel">{t('deliveryPresentiel')}</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-ink-muted">
                    {t('feePrice')}
                  </span>
                  <input
                    name="price"
                    defaultValue={toEuros(fee.priceCents)}
                    inputMode="decimal"
                    className={`${field} w-28`}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-ink-muted">
                    {t('feeDuration')}
                  </span>
                  <input
                    type="number"
                    name="duration_days"
                    defaultValue={fee.durationDays}
                    min={1}
                    max={3650}
                    className={`${field} w-24`}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-ink-muted">
                    {t('feeStatus')}
                  </span>
                  <select name="status" defaultValue={fee.status} className={field}>
                    <option value="published">{t('published')}</option>
                    <option value="draft">{t('draft')}</option>
                    <option value="archived">{t('archived')}</option>
                  </select>
                </label>

                <Button type="submit" size="sm" variant="ghost">
                  {t('save')}
                </Button>
              </form>

              <form action={remove} className="mt-2">
                <input type="hidden" name="id" value={fee.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted transition-colors hover:text-red-600"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t('feeRemove')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/* Only offer a mode that has no price yet: two live prices for the same
          course and mode have no answer to "which one is charged?", and the
          database's partial unique index refuses them anyway. */}
      {free.length > 0 && (
        <form
          action={add}
          className="flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/40 p-4"
        >
          <input type="hidden" name="kind" value="module" />
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="duration_days" value="365" />
          <input type="hidden" name="status" value="published" />

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-muted">{t('feeMode')}</span>
            <select name="delivery" defaultValue={free[0]} className={field}>
              {free.map((d) => (
                <option key={d} value={d}>
                  {d === 'online' ? t('deliveryOnline') : t('deliveryPresentiel')}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-muted">{t('feePrice')}</span>
            <input name="price" placeholder="300" inputMode="decimal" className={`${field} w-28`} />
          </label>

          <Button type="submit" size="sm">
            {t('feeAdd')}
          </Button>

          <p className="w-full text-[11px] text-ink-muted">{t('feeHint')}</p>
        </form>
      )}

      {addState.error && (
        <p role="alert" className="text-[12px] text-red-600">
          {t(`errors.${addState.error}` as 'errors.saveFailed')}
        </p>
      )}
    </div>
  );
}
