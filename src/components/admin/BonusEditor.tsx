'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Gift, Trash2 } from 'lucide-react';
import { ActionError } from '@/components/admin/ActionError';
import { SaveButton } from '@/components/admin/SaveButton';
import { Badge } from '@/components/ui/badge';
import { deletePack, saveBonus } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';
import { ActionForm } from '@/components/ui/action-form';

const IDLE: AdminState = { ok: false };

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
  /** The MODULE thrown in, not one of its two priced products. */
  freeCourseId: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
}

/**
 * A bonus is one sentence: buy this, receive that.
 *
 * The two halves are deliberately different KINDS of thing. What is paid for is
 * a product — a module in one mode, because that is what has a price. What is
 * received is a MODULE, with no mode attached: the student gets it in whichever
 * mode they are buying, which is both the only thing the basket can price and
 * the only thing that means anything, since an entitlement is to a course and
 * not to a mode of attending it.
 *
 * The slug, the title, the delivery and the pricing rule are all derived
 * server-side — facts about the choice, not decisions to hand the teacher.
 */
export function BonusEditor({
  products,
  giftModules,
  bonuses,
}: {
  products: ProductChoice[];
  /** Modules that can be thrown in. One entry per module, not per mode. */
  giftModules: ProductChoice[];
  bonuses: BonusRow[];
}) {
  const t = useTranslations('admin');
  const [state, save] = useActionState(saveBonus, IDLE);
  const [, remove] = useActionState(deletePack, IDLE);

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

  const giftOptions = (
    <>
      {giftModules.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </>
  );

  return (
    <div className="space-y-4">
      {bonuses.length > 0 && (
        <ul className="space-y-3">
          {bonuses.map((b) => (
            <li key={b.id} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
              <ActionForm action={save} className="flex flex-wrap items-center gap-2 text-[13px]">
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
                  name="free_course_id"
                  defaultValue={b.freeCourseId ?? ''}
                  className={select}
                >
                  {giftOptions}
                </select>

                <select name="status" defaultValue={b.status} className={select}>
                  <option value="published">{t('published')}</option>
                  <option value="draft">{t('draft')}</option>
                  <option value="archived">{t('archived')}</option>
                </select>

                <SaveButton state={state} label={t('save')} size="sm" variant="ghost" />
                </ActionForm>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                {b.maxRedemptions !== null && (
                  <Badge variant="muted">
                    {b.redeemedCount}/{b.maxRedemptions}
                  </Badge>
                )}
                <ActionForm
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
              </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ActionForm
        action={save}
        className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/40 p-4 text-[13px]"
      >
        <Gift className="size-4 text-brand-500" aria-hidden="true" />
        <span className="text-ink-muted">{t('bonusIfBuys')}</span>
        <select name="buy_product_id" className={select} defaultValue={products[0]?.id}>
          {options}
        </select>

        <span className="text-ink-muted">{t('bonusThenGets')}</span>
        <select name="free_course_id" className={select} defaultValue={giftModules[0]?.id}>
          {giftOptions}
        </select>

        <input type="hidden" name="status" value="published" />
        <SaveButton state={state} label={t('bonusAdd')} size="sm" />
      </ActionForm>

      <ActionError state={state} />
    </div>
  );
}
