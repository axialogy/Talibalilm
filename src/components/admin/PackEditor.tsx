'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { deletePack, savePack, togglePackItem } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

export interface PackView {
  id: string;
  slug: string;
  title: string;
  description: string;
  delivery: 'presentiel' | 'online';
  pricing: 'sum' | 'fixed' | 'percent';
  priceCents: number | null;
  percentOff: number | null;
  status: 'draft' | 'published' | 'archived';
  maxRedemptions: number | null;
  displayOrder: number;
  items: { productId: string; isFree: boolean }[];
}

export interface ProductChoice {
  id: string;
  label: string;
  delivery: 'presentiel' | 'online';
  price: string;
}

function toEuros(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * One offer, and what is in it.
 *
 * The membership form is three radios per product rather than a checkbox plus
 * a "free" toggle: a product is out of the offer, charged, or given away, and
 * those are one choice, not two.
 */
export function PackEditor({ pack, products }: { pack?: PackView; products: ProductChoice[] }) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(savePack, EMPTY);
  const [, removeAction] = useActionState(deletePack, EMPTY);
  const [, itemAction] = useActionState(togglePackItem, EMPTY);

  const membership = new Map(pack?.items.map((i) => [i.productId, i.isFree]));
  const relevant = pack ? products.filter((p) => p.delivery === pack.delivery) : [];

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
      <form action={action} className="space-y-4">
        {pack && <input type="hidden" name="id" value={pack.id} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('packTitle')} name="title" defaultValue={pack?.title ?? ''} required />
          <Field
            label={t('packSlug')}
            name="slug"
            defaultValue={pack?.slug ?? ''}
            required
            error={
              state.error === 'slugTaken' || state.error === 'slugShape'
                ? t(`errors.${state.error}` as 'errors.slugTaken')
                : undefined
            }
          />

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('delivery')}</span>
            <select
              name="delivery"
              defaultValue={pack?.delivery ?? 'online'}
              className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
            >
              <option value="presentiel">{t('deliveryPresentiel')}</option>
              <option value="online">{t('deliveryOnline')}</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">
              {t('packPricing')}
            </span>
            <select
              name="pricing"
              defaultValue={pack?.pricing ?? 'sum'}
              className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
            >
              <option value="sum">{t('pricingSum')}</option>
              <option value="fixed">{t('pricingFixed')}</option>
              <option value="percent">{t('pricingPercent')}</option>
            </select>
          </label>

          <Field
            label={t('price')}
            name="price"
            inputMode="decimal"
            defaultValue={pack?.priceCents !== null && pack?.priceCents !== undefined ? toEuros(pack.priceCents) : ''}
            error={state.error === 'priceInvalid' ? t('errors.priceInvalid') : undefined}
          />
          <Field
            label={t('percentOff')}
            name="percent_off"
            type="number"
            min={1}
            max={100}
            defaultValue={pack?.percentOff ?? ''}
            error={state.error === 'percentRequired' ? t('errors.percentRequired') : undefined}
          />

          <Field
            label={t('maxRedemptions')}
            name="max_redemptions"
            type="number"
            min={1}
            defaultValue={pack?.maxRedemptions ?? ''}
          />

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('status')}</span>
            <select
              name="status"
              defaultValue={pack?.status ?? 'draft'}
              className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
            >
              <option value="draft">{t('draft')}</option>
              <option value="published">{t('published')}</option>
              <option value="archived">{t('archived')}</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('description')}</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={pack?.description ?? ''}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm">
            {t('save')}
          </Button>
          {state.ok && !state.error && (
            <span role="status" className="text-[11px] text-brand-600">
              {t('saved')}
            </span>
          )}
          {state.error === 'saveFailed' && (
            <span role="alert" className="text-[11px] text-red-600">
              {t('errors.saveFailed')}
            </span>
          )}
        </div>
      </form>

      {pack && (
        <>
          <h3 className="mt-6 border-t border-line pt-5 text-[13px] font-medium text-ink">
            {t('packItems')}
          </h3>
          <ul className="mt-3 space-y-2">
            {relevant.map((product) => {
              const state_ = membership.has(product.id)
                ? membership.get(product.id)
                  ? 'free'
                  : 'paid'
                : 'remove';
              return (
                <li
                  key={product.id}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-input)] bg-surface/60 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 text-[13px] text-ink">
                    {product.label}
                    <span className="text-ink-muted"> · {product.price}</span>
                  </span>
                  <span className="flex gap-1">
                    {(['remove', 'paid', 'free'] as const).map((mode) => (
                      <form key={mode} action={itemAction}>
                        <input type="hidden" name="pack_id" value={pack.id} />
                        <input type="hidden" name="product_id" value={product.id} />
                        <input type="hidden" name="mode" value={mode} />
                        <button
                          type="submit"
                          aria-pressed={state_ === mode}
                          className={`rounded-full px-3 py-1.5 text-[11px] transition-colors ${
                            state_ === mode
                              ? 'bg-brand-500 text-white'
                              : 'bg-white text-ink-muted hover:text-brand-600'
                          }`}
                        >
                          {mode === 'remove'
                            ? t('packItemOut')
                            : mode === 'paid'
                              ? t('packItemPaid')
                              : t('packItemFree')}
                        </button>
                      </form>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>

          <form
            action={removeAction}
            className="mt-5 flex justify-end"
            onSubmit={(event) => {
              if (!window.confirm(t('confirmDelete'))) event.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={pack.id} />
            <Button type="submit" size="sm" variant="ghost">
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t('delete')}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
