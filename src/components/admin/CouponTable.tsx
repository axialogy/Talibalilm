'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ActionError } from '@/components/admin/ActionError';
import { VoidCouponButton } from '@/components/admin/CouponActions';
import { deleteCoupons } from '@/app/actions/office';
import { formatPrice } from '@/lib/commerce/quote';
import type { CouponRowView } from '@/lib/data/admin';
import type { AdminState } from '@/app/actions/admin';

const IDLE: AdminState = { ok: false };

/**
 * The coupon list, with a selection.
 *
 * Deleting is the office cleaning up after itself — a batch of codes that has
 * done its job — so it is a deliberate, confirmed, audited action, not a
 * background sweep. A code is not a record of a sale: the database nulls
 * `orders.coupon_id` and keeps the order, and the confirmation says so before
 * anything goes.
 *
 * The selection covers the rows on screen, which is the filtered batch. The
 * list is capped at 500 rows upstream, so "select all" can never mean "every
 * code the school ever made".
 */
export function CouponTable({ rows, locale }: { rows: CouponRowView[]; locale: string }) {
  const t = useTranslations('admin');
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [state, setState] = useState<AdminState>(IDLE);
  const [deleted, setDeleted] = useState(0);
  const [pending, startTransition] = useTransition();

  const allChosen = rows.length > 0 && chosen.size === rows.length;

  const discount = (c: CouponRowView) =>
    c.percentOff !== null ? `${c.percentOff}%` : formatPrice(c.amountOffCents ?? 0, locale);

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function remove() {
    const ids = [...chosen];
    if (ids.length === 0) return;
    if (!window.confirm(t('couponsDeleteConfirm', { count: ids.length }))) return;

    startTransition(async () => {
      const result = await deleteCoupons(ids);
      setState(result);
      if (result.ok) {
        setDeleted(ids.length);
        setChosen(new Set());
      }
    });
  }

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[12px] text-ink-muted">
          {chosen.size > 0 ? t('couponsSelected', { count: chosen.size }) : t('couponsSelectHint')}
        </span>
        {chosen.size > 0 && (
          <Button type="button" size="sm" variant="danger" onClick={remove} disabled={pending}>
            <Trash2 aria-hidden="true" />
            {pending ? t('couponsDeleting') : t('couponsDelete')}
          </Button>
        )}
        {deleted > 0 && !state.error && (
          <span role="status" className="text-[12px] text-brand-600">
            {t('couponsDeleted', { count: deleted })}
          </span>
        )}
      </div>

      <ActionError state={state} className="mt-2" />

      <div className="mt-3 overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface/60 text-left text-[11px] tracking-wide text-ink-muted uppercase">
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={allChosen}
                  onChange={() =>
                    setChosen(allChosen ? new Set() : new Set(rows.map((row) => row.id)))
                  }
                  aria-label={t('couponsSelectAll')}
                  className="size-4 accent-brand-500"
                />
              </th>
              <th className="p-3 font-medium">{t('colCode')}</th>
              <th className="p-3 font-medium">{t('colDiscount')}</th>
              <th className="p-3 font-medium">{t('colUses')}</th>
              <th className="p-3 font-medium">{t('colBatch')}</th>
              <th className="p-3 font-medium">{t('colStatus')}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-brand-50/40">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={chosen.has(c.id)}
                    onChange={() => toggle(c.id)}
                    aria-label={c.code}
                    className="size-4 accent-brand-500"
                  />
                </td>
                <td className="p-3 font-mono text-ink">
                  {c.code}
                  {c.isOffice && (
                    <Badge variant="gold" className="ml-2">
                      {t('couponOffice')}
                    </Badge>
                  )}
                </td>
                <td className="p-3 text-ink">{discount(c)}</td>
                <td className="p-3 text-ink-muted tabular-nums">
                  {c.redeemedCount}
                  {c.maxRedemptions !== null && ` / ${c.maxRedemptions}`}
                </td>
                <td className="p-3 text-ink-muted">{c.batch || '—'}</td>
                <td className="p-3">
                  <Badge variant={c.spent ? 'muted' : 'success'}>
                    {c.spent ? t('couponSpent') : t('couponAvailable')}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  {!c.spent && <VoidCouponButton couponId={c.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
