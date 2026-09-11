import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckCircle2 } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/commerce/quote';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

/**
 * After the money has moved.
 *
 * Read through the ordinary anon client, so `orders_select_own` decides what
 * is shown: an order id in the URL belonging to somebody else renders nothing.
 * The page is a receipt, not the thing that grants access — that already
 * happened server-side, in `grant_order_entitlements`.
 */
export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { locale } = await params;
  const { order: orderId } = await searchParams;
  setRequestLocale(locale);

  if (!supabaseConfigured || !orderId) redirect({ href: '/dashboard', locale });

  const t = await getTranslations('checkout');
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, total_cents, currency, order_items ( product_id, title, schedule_label )')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || order.status !== 'paid') redirect({ href: '/dashboard', locale });

  return (
    <>
      <div className="text-center">
        <span
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600"
          aria-hidden="true"
        >
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
          {t('confirmTitle')}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{t('confirmLead')}</p>
        <p className="mt-1 text-[11px] tracking-wide text-ink-muted/80 uppercase">
          {t('confirmRef', { ref: order.id.slice(0, 8) })}
        </p>
      </div>

      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-white p-6">
        <h2 className="font-display text-[15px] font-semibold text-ink">{t('confirmItems')}</h2>
        <ul className="mt-4 space-y-2">
          {(order.order_items ?? []).map((item) => (
            <li key={item.product_id} className="text-[13px] text-ink-muted">
              <span className="text-ink">{item.title}</span>
              {item.schedule_label && <span> — {item.schedule_label}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-line pt-4 text-right font-display text-lg font-semibold text-ink">
          {formatPrice(order.total_cents, locale, order.currency)}
        </p>
      </div>

      <div className="mt-8 text-center">
        <Button asChild size="lg">
          <Link href="/dashboard">{t('confirmCta')}</Link>
        </Button>
      </div>
    </>
  );
}
