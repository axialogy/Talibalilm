'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { generateCoupons, type GenerateState } from '@/app/actions/office';

const EMPTY: GenerateState = { ok: true };

/**
 * Mint a batch of codes for the front desk.
 *
 * The codes come back once, here, and are shown for copying immediately —
 * they are never retrievable afterwards, by design, so the office copies them
 * into their own record now or regenerates. Everything else about them (how
 * many, whether spent) stays visible in the list below.
 */
export function CouponGenerator() {
  const t = useTranslations('admin');
  const [state, action] = useActionState(generateCoupons, EMPTY);
  const [kind, setKind] = useState<'office' | 'percent' | 'amount'>('office');
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    if (!state.codes) return;
    try {
      await navigator.clipboard.writeText(state.codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the codes are on screen to copy by hand.
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
      <form action={action} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">
              {t('generateKind')}
            </span>
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'office' | 'percent' | 'amount')}
              className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
            >
              <option value="office">{t('kindOffice')}</option>
              <option value="percent">{t('kindPercent')}</option>
              <option value="amount">{t('kindAmount')}</option>
            </select>
          </label>
          <Field
            label={t('genQuantity')}
            name="quantity"
            type="number"
            min={1}
            max={500}
            defaultValue={10}
          />

          {kind === 'percent' && (
            <Field
              label={t('genPercent')}
              name="percentOff"
              type="number"
              min={1}
              max={100}
              error={state.error === 'percentRequired' ? t('errors.percentRequired') : undefined}
            />
          )}
          {kind === 'amount' && (
            <Field
              label={t('genAmount')}
              name="amountOff"
              inputMode="decimal"
              error={state.error === 'amountRequired' ? t('errors.amountRequired') : undefined}
            />
          )}

          <Field
            label={t('genMaxUses')}
            name="maxRedemptions"
            type="number"
            min={1}
            defaultValue={1}
          />
          <Field
            label={t('genBatch')}
            name="batch"
            placeholder="sept-2026"
            hint={t('genBatchHint')}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm">
            {t('genSubmit')}
          </Button>
          {state.error && !['percentRequired', 'amountRequired'].includes(state.error) && (
            <span role="alert" className="text-[11px] text-red-600">
              {t(`errors.${state.error}` as 'errors.saveFailed')}
            </span>
          )}
        </div>
      </form>

      {state.codes && state.codes.length > 0 && (
        <div className="mt-5 rounded-[var(--radius-input)] border border-brand-200 bg-brand-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-brand-700">
              {t('genResult', { count: state.codes.length })}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={copyAll}>
              {copied ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {t('copyAll')}
            </Button>
          </div>
          <ul className="mt-3 grid gap-1 font-mono text-[12px] text-ink sm:grid-cols-2">
            {state.codes.map((code) => (
              <li key={code} className="rounded bg-white px-2 py-1">
                {code}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
