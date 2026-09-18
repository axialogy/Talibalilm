'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, Tag } from 'lucide-react';
import { SubmitButton } from '@/components/ui/submit-button';
import { applyCoupon, type CouponState } from '@/app/actions/checkout';
import { formatPrice } from '@/lib/commerce/quote';
import type { CouponPreview } from '@/lib/commerce/coupons';

const EMPTY: CouponState = { ok: false };

/**
 * The code box, and the answer.
 *
 * The stored code is validated server-side on every render (read-only — it is
 * still claimed atomically when the order opens), so the line under the field
 * is what the student will actually be charged: the amount taken off and the
 * new total. A refusal says which refusal it is, because "unknown", "expired"
 * and "already used" lead to three different phone calls.
 */
export function CouponForm({
  defaultValue,
  coupon,
  totalCents,
  locale,
}: {
  defaultValue: string;
  coupon: CouponPreview;
  /** The total after the coupon, so the line can name it. */
  totalCents: number;
  locale: string;
}) {
  const t = useTranslations('checkout');
  const [state, action] = useActionState(applyCoupon, EMPTY);

  const fieldError = state.error
    ? t(state.error === 'rateLimited' ? 'rateLimited' : 'codeInvalid')
    : null;

  return (
    <div>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1">
          <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <Tag className="size-3.5 text-ink-muted" aria-hidden="true" />
            {t('couponLabel')}
          </span>
          <input
            name="code"
            defaultValue={defaultValue}
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm tracking-wide text-ink uppercase outline-none focus:border-brand-400"
          />
          <span className="mt-1.5 block text-[11px] text-ink-muted">{t('couponHint')}</span>
        </label>
        <SubmitButton variant="outline" size="md">
          {t('couponApply')}
        </SubmitButton>
      </form>

      {fieldError ? (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[12px] text-red-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {fieldError}
        </p>
      ) : coupon.status === 'valid' ? (
        <p
          role="status"
          className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-brand-600"
        >
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          {t('couponApplied', {
            code: coupon.coupon.code,
            amount: formatPrice(coupon.discountCents, locale),
          })}
          <span className="text-ink-muted">
            {totalCents > 0
              ? t('couponNewTotal', { total: formatPrice(totalCents, locale) })
              : t('couponCleared')}
          </span>
        </p>
      ) : coupon.status === 'invalid' ? (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[12px] text-red-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {t(`couponRefused.${coupon.reason}`)}
        </p>
      ) : null}
    </div>
  );
}
