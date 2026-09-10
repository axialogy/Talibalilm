import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['cursus', 'mode', 'modules', 'review', 'payment'] as const;

/**
 * Where the student is in the flow.
 *
 * Rendered as an ordered list rather than a row of divs so a screen reader
 * announces "3 of 5" without needing the visual position, and `aria-current`
 * marks the step being filled in.
 */
export async function CheckoutSteps({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  const t = await getTranslations('checkout');

  return (
    <nav aria-label={t('title')}>
      <p className="text-[11px] tracking-[0.1em] text-ink-muted uppercase">
        {t('step', { current, total: STEPS.length })}
      </p>
      <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
        {STEPS.map((step, index) => {
          const number = index + 1;
          const done = number < current;
          const active = number === current;
          return (
            <li key={step} className="flex items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  active && 'bg-brand-50 font-medium text-brand-700',
                  done && 'text-brand-600',
                  !active && !done && 'text-ink-muted',
                )}
              >
                {done ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">{number}.</span>
                )}
                {t(`steps.${step}`)}
              </span>
              {index < STEPS.length - 1 && (
                <span aria-hidden="true" className="text-ink-muted/30">
                  ·
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
