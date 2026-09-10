'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { deleteProduct, saveProduct } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

export interface ProductRowView {
  id: string;
  kind: 'module' | 'cursus';
  courseId: string | null;
  cursusId: string | null;
  yearIndex: number;
  delivery: 'presentiel' | 'online';
  timeSlot: string;
  scheduleLabel: string;
  hoursPerYear: number | null;
  /** Tenths of an hour, as stored. */
  hoursPerWeek: number | null;
  language: string;
  priceCents: number;
  durationDays: number;
  status: 'draft' | 'published' | 'archived';
  displayOrder: number;
  label: string;
}

export interface Option {
  id: string;
  title: string;
}

/** Cents to what a person types back in: "300", "300.50". */
function toEuros(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * One row of the price list.
 *
 * The same form creates and edits, because they differ only by whether an id
 * is present — two forms would be two places for a field to go missing.
 */
export function ProductForm({
  product,
  courses,
  cursus,
  onDone,
}: {
  product?: ProductRowView;
  courses: Option[];
  cursus: Option[];
  onDone?: () => void;
}) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(saveProduct, EMPTY);
  const [kind, setKind] = useState(product?.kind ?? 'module');

  return (
    <form
      action={(formData) => {
        action(formData);
        onDone?.();
      }}
      className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5"
    >
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('productKind')}</span>
          <select
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as 'module' | 'cursus')}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="module">{t('kindModule')}</option>
            <option value="cursus">{t('kindCursus')}</option>
          </select>
        </label>

        {kind === 'module' ? (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('course')}</span>
            <select
              name="course_id"
              defaultValue={product?.courseId ?? ''}
              className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
            >
              <option value="">—</option>
              {courses.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('cursus')}</span>
            <select
              name="cursus_id"
              defaultValue={product?.cursusId ?? ''}
              className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
            >
              <option value="">—</option>
              {cursus.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('delivery')}</span>
          <select
            name="delivery"
            defaultValue={product?.delivery ?? 'presentiel'}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="presentiel">{t('deliveryPresentiel')}</option>
            <option value="online">{t('deliveryOnline')}</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">
            {t('teachingLanguage')}
          </span>
          <select
            name="language"
            defaultValue={product?.language ?? 'fr'}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </select>
        </label>

        <Field
          label={t('timeSlot')}
          name="time_slot"
          defaultValue={product?.timeSlot ?? ''}
          hint={t('timeSlotHint')}
        />
        <Field
          label={t('scheduleLabel')}
          name="schedule_label"
          defaultValue={product?.scheduleLabel ?? ''}
          hint={t('scheduleLabelHint')}
        />

        <Field
          label={t('price')}
          name="price"
          inputMode="decimal"
          defaultValue={product ? toEuros(product.priceCents) : ''}
          required
          error={state.error === 'priceInvalid' ? t('errors.priceInvalid') : undefined}
        />
        <Field
          label={t('durationDays')}
          name="duration_days"
          type="number"
          min={1}
          defaultValue={product?.durationDays ?? 365}
        />

        <Field
          label={t('hoursPerYear')}
          name="hours_per_year"
          type="number"
          min={0}
          defaultValue={product?.hoursPerYear ?? ''}
        />
        <Field
          label={t('hoursPerWeek')}
          name="hours_per_week"
          inputMode="decimal"
          defaultValue={product?.hoursPerWeek !== null && product?.hoursPerWeek !== undefined
            ? String(product.hoursPerWeek / 10)
            : ''}
        />

        {kind === 'cursus' && (
          <Field
            label={t('yearIndex')}
            name="year_index"
            type="number"
            min={1}
            max={10}
            defaultValue={product?.yearIndex ?? 1}
          />
        )}

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('status')}</span>
          <select
            name="status"
            defaultValue={product?.status ?? 'draft'}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="draft">{t('draft')}</option>
            <option value="published">{t('published')}</option>
            <option value="archived">{t('archived')}</option>
          </select>
        </label>

        <Field
          label={t('displayOrder')}
          name="display_order"
          type="number"
          min={0}
          defaultValue={product?.displayOrder ?? 0}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm">
          {product ? <>{t('save')}</> : <><Plus className="size-3.5" aria-hidden="true" />{t('newProduct')}</>}
        </Button>
        {state.ok && !state.error && (
          <span role="status" className="text-[11px] text-brand-600">
            {t('saved')}
          </span>
        )}
        {state.error && state.error !== 'priceInvalid' && (
          <span role="alert" className="text-[11px] text-red-600">
            {t(`errors.${state.error}` as 'errors.saveFailed')}
          </span>
        )}
      </div>
    </form>
  );
}

/** Deleting is refused once a row has been ordered, so archiving is offered. */
export function DeleteProductButton({ id }: { id: string }) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(deleteProduct, EMPTY);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(t('confirmDelete'))) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost" aria-label={t('delete')}>
        <Trash2 className="size-3.5" aria-hidden="true" />
      </Button>
      {state.error && (
        <span role="alert" className="block text-[11px] text-red-600">
          {t(`errors.${state.error}` as 'errors.saveFailed')}
        </span>
      )}
    </form>
  );
}
