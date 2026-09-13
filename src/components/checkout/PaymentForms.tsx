'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Gift, Lock, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/auth/SubmitButton';
import {
  claimFreeCourse,
  redeemOfficeCode,
  startPayPalCheckout,
  type PayState,
} from '@/app/actions/pay';

const EMPTY: PayState = {};

/** Action errors are keys, resolved here so a stray string cannot reach a reader. */
const MESSAGE: Record<
  string,
  | 'payUnavailable'
  | 'payRefused'
  | 'codeInvalid'
  | 'codeRefused'
  | 'codePartial'
  | 'packExhausted'
  | 'mixedCurrency'
  | 'rateLimited'
  | 'notFree'
> = {
  unavailable: 'payUnavailable',
  paypalRefused: 'payRefused',
  codeInvalid: 'codeInvalid',
  codeRefused: 'codeRefused',
  codePartial: 'codePartial',
  packExhausted: 'packExhausted',
  mixedCurrency: 'mixedCurrency',
  rateLimited: 'rateLimited',
  notFree: 'notFree',
};

/**
 * The two ways to pay.
 *
 * Neither form carries an amount. The PayPal button posts an empty form: the
 * server reprices the basket, opens the order and redirects to PayPal. The
 * office form posts only a code, which the database spends atomically.
 */
export function PaymentForms({
  paypalAvailable,
  free = false,
}: {
  paypalAvailable: boolean;
  /** The basket totals zero once repriced from the catalogue. */
  free?: boolean;
}) {
  const t = useTranslations('checkout');
  const [payState, payAction] = useActionState(startPayPalCheckout, EMPTY);
  const [codeState, codeAction] = useActionState(redeemOfficeCode, EMPTY);
  const [freeState, freeAction] = useActionState(claimFreeCourse, EMPTY);

  const payError = payState.error ? MESSAGE[payState.error] : undefined;
  const codeError = codeState.error ? MESSAGE[codeState.error] : undefined;
  const freeError = freeState.error ? MESSAGE[freeState.error] : undefined;

  // Nothing to pay: showing a PayPal button and a cash-code box here would be
  // asking the student to settle a bill of zero. One button, and it is done.
  if (free) {
    return (
      <form action={freeAction}>
        <SubmitButton>
          <Gift className="size-4" aria-hidden="true" />
          {t('claimFree')}
        </SubmitButton>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{t('claimFreeNote')}</p>
        {freeError && (
          <p role="alert" className="mt-3 text-[12px] text-red-600">
            {t(freeError)}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="space-y-6">
      {paypalAvailable ? (
        <form action={payAction}>
          <SubmitButton>
            <Lock className="size-4" aria-hidden="true" />
            {t('payWithPaypal')}
          </SubmitButton>
          {payError && (
            <p role="alert" className="mt-3 text-[12px] text-red-600">
              {t(payError)}
            </p>
          )}
        </form>
      ) : (
        <div>
          <Button block size="lg" disabled>
            <Lock className="size-4" aria-hidden="true" />
            {t('payWithPaypal')}
          </Button>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{t('payUnavailable')}</p>
        </div>
      )}

      <div className="rounded-[var(--radius-card)] border border-line bg-surface/50 p-5">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
          <Store className="size-4 text-brand-500" aria-hidden="true" />
          {t('payOffice')}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t('payOfficeBody')}</p>

        <form action={codeAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">
              {t('officeCodeLabel')}
            </span>
            <input
              name="code"
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={codeError ? true : undefined}
              className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm tracking-wide text-ink uppercase outline-none focus:border-brand-400"
            />
          </label>
          <Button type="submit" variant="outline" size="md">
            {t('officeCodeApply')}
          </Button>
        </form>

        {codeError && (
          <p role="alert" className="mt-3 text-[12px] text-red-600">
            {t(codeError)}
          </p>
        )}
      </div>
    </div>
  );
}
