'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Gift, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deletePack, saveBonus } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

export interface ProductChoice {
  id: string;
  label: string;
  delivery: 'presentiel' | 'online';
}

export interface BonusRow {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  buyProductId: string | null;
  freeProductId: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
}

/**
 * A bonus is one sentence: buy this, receive that.
 *
 * So the form is that sentence with two dropdowns in it, and nothing else to
 * fill in. The slug, the title, the delivery mode and the pricing rule are all
 * derived server-side — they are facts about the two products, not decisions
 * the teacher should be asked to make.
 */
export function BonusEditor({
  products,
  bonuses,
}: {
  products: ProductChoice[];
  bonuses: BonusRow[];
}) {
  const t = useTranslations('admin');
  const [state, save] = useActionState(saveBonus, EMPTY);
  const [, remove] = useActionState(deletePack, EMPTY);

  const select =
    'rounded-[var(--radius-input)] border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400';

  if (products.length < 2) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-6 text-center text-[13px] text-ink-muted">
        {t('bonusNeedsProducts')}
      </p>
    );
  }

  const options = (
    <>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </>
  );

  return (
    <div className="space-y-4">
      {bonuses.length > 0 && (
        <ul className="space-y-3">
          {bonuses.map((b) => (
            <li
              key={b.id}
              className="rounded-[var(--radius-card)] border border-line bg-white p-4"
            >
              <form action={save} className="flex flex-wrap items-center gap-2 text-[13px]">
                <input type="hidden" name="id" value={b.id} />

                <Gift className="size-4 text-brand-500" aria-hidden="true" />
                <span className="text-ink-muted">{t('bonusIfBuys')}</span>
                <select
                  name="buy_product_id"
                  defaultValue={b.buyProductId ?? ''}
                  className={select}
                >
                  {options}
                </select>

                <span className="text-ink-muted">{t('bonusThenGets')}</span>
                <select
                  name="free_product_id"
                  defaultValue={b.freeProductId ?? ''}
                  className={select}
                >
                  {options}
                </select>

                <select name="status" defaultValue={b.status} className={select}>
                  <option value="published">{t('published')}</option>
                  <option value="draft">{t('draft')}</option>
                  <option value="archived">{t('archived')}</option>
                </select>

                <Button type="submit" size="sm" variant="ghost">
                  {t('save')}
                </Button>
              </form>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                {b.maxRedemptions !== null && (
                  <Badge variant="muted">
                    {b.redeemedCount}/{b.maxRedemptions}
                  </Badge>
                )}
                <form
                  action={remove}
                  onSubmit={(event) => {
                    if (!window.confirm(t('bonusDeleteConfirm'))) event.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={b.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted transition-colors hover:text-red-600"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    {t('bonusDelete')}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        action={save}
        className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/40 p-4 text-[13px]"
      >
        <Gift className="size-4 text-brand-500" aria-hidden="true" />
        <span className="text-ink-muted">{t('bonusIfBuys')}</span>
        <select name="buy_product_id" className={select} defaultValue={products[0]?.id}>
          {options}
        </select>

        <span className="text-ink-muted">{t('bonusThenGets')}</span>
        <select name="free_product_id" className={select} defaultValue={products[1]?.id}>
          {options}
        </select>

        <input type="hidden" name="status" value="published" />
        <Button type="submit" size="sm">
          {t('bonusAdd')}
        </Button>
      </form>

      {state.error && (
        <p role="alert" className="text-[12px] text-red-600">
          {t(`errors.${state.error}` as 'errors.saveFailed')}
        </p>
      )}
    </div>
  );
}
