'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Store } from 'lucide-react';
import { PayPalButton } from '@/components/checkout/PayPalButton';
import { SubmitButton } from '@/components/ui/submit-button';
import { redeemInstallmentCode, type PayState } from '@/app/actions/pay';
import type { PayPalPublicConfig } from '@/lib/paypal/types';

const EMPTY: PayState = {};

/** Action errors are keys; this resolves them to sentences. */
const MESSAGE: Record<string, string> = {
  unavailable: 'payUnavailable',
  paypalRefused: 'payRefused',
  rateLimited: 'rateLimited',
  notApproved: 'notApproved',
  codeInvalid: 'codeInvalid',
  codeRefused: 'codeRefused',
  codePartial: 'codePartial',
  payUnexpected: 'payUnexpected',
};

/**
 * Paying one installment.
 *
 * Two ways, the same two as the checkout: PayPal, which charges exactly this
 * installment's amount because the server reads it from the row, and the desk
 * code the office hands over when the cash was taken. The client sends the
 * installment id and a code; it never sends an amount.
 */
export function InstallmentPayment({
  installmentId,
  paypal,
  locale,
}: {
  installmentId: string;
  paypal: PayPalPublicConfig | null;
  locale: string;
}) {
  const t = useTranslations('checkout');
  const [state, action] = useActionState(redeemInstallmentCode, EMPTY);
  const error = state.error ? t(MESSAGE[state.error] ?? 'payUnexpected') : null;

  return (
    <div className="space-y-3">
      {paypal ? (
        <PayPalButton
          clientId={paypal.clientId}
          currency={paypal.currency}
          locale={locale}
          installmentId={installmentId}
        />
      ) : (
        <p className="text-[12px] leading-relaxed text-ink-muted">{t('payUnavailable')}</p>
      )}

      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="installmentId" value={installmentId} />
        <label className="min-w-[160px] flex-1">
          <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink">
            <Store className="size-3.5 text-ink-muted" aria-hidden="true" />
            {t('officeCodeLabel')}
          </span>
          <input
            name="code"
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2 text-sm tracking-wide text-ink uppercase outline-none focus:border-brand-400"
          />
        </label>
        <SubmitButton variant="outline" size="sm">
          {t('officeCodeApply')}
        </SubmitButton>
      </form>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-[12px] text-red-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
