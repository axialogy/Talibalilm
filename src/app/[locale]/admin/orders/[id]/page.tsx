import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { formatPrice } from '@/lib/commerce/quote';
import { getOrder } from '@/lib/data/admin';
import { cap } from '@/lib/utils';

/** One order in full — line items, PayPal identifiers, and a link to the buyer. */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const order = await getOrder(id);
  if (!order) notFound();

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' });
  const money = (c: number) => formatPrice(c, locale, order.currency);

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-2 text-xs text-ink-muted transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t('backToOrders')}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {t('orderDetail')} {order.id.slice(0, 8)}
        </h1>
        <StatusBadge status={order.status} label={t(`status${cap(order.status)}` as 'statusPaid')} />
      </div>

      <dl className="mt-6 grid gap-2 rounded-[var(--radius-card)] border border-line bg-white p-5 text-[13px] sm:grid-cols-[130px_minmax(0,1fr)]">
        <dt className="text-ink-muted">{t('colDate')}</dt>
        <dd className="text-ink">{dateFmt.format(new Date(order.createdAt))}</dd>
        <dt className="text-ink-muted">{t('colStudent')}</dt>
        <dd>
          <Link href={`/admin/students/${order.userId}`} className="text-brand-600 hover:underline">
            {order.email ?? order.userId}
          </Link>
        </dd>
        <dt className="text-ink-muted">{t('colRoute')}</dt>
        <dd className="text-ink">{t(`route${cap(order.route)}` as 'routePaypal')}</dd>
        <dt className="text-ink-muted">{t('feeMode')}</dt>
        <dd className="text-ink">
          {order.delivery === 'online' ? t('deliveryOnline') : t('deliveryPresentiel')}
        </dd>
        {order.paidAt && (
          <>
            <dt className="text-ink-muted">{t('orderPaidAt')}</dt>
            <dd className="text-ink">{dateFmt.format(new Date(order.paidAt))}</dd>
          </>
        )}
        {order.couponCode && (
          <>
            <dt className="text-ink-muted">{t('orderCoupon')}</dt>
            <dd className="font-mono text-ink">{order.couponCode}</dd>
          </>
        )}
        {order.packTitle && (
          <>
            <dt className="text-ink-muted">{t('orderPack')}</dt>
            <dd className="text-ink">{order.packTitle}</dd>
          </>
        )}
        {order.statusReason && (
          <>
            <dt className="text-ink-muted">{t('orderReason')}</dt>
            <dd className="text-ink">{order.statusReason}</dd>
          </>
        )}
      </dl>

      <h2 className="mt-8 font-display text-[15px] font-semibold text-ink">{t('orderItems')}</h2>
      <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
        {order.items.map((i) => (
          <li key={i.productId} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{i.title}</p>
              <p className="text-[11px] text-ink-muted">
                {[
                  i.scheduleLabel || null,
                  i.delivery === 'online' ? t('deliveryOnline') : t('deliveryPresentiel'),
                  t('orderItemDays', { n: i.durationDays }),
                  i.isFree ? t('orderItemFree') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <span className="text-[13px] font-medium text-ink tabular-nums">
              {i.isFree ? '—' : money(i.unitPriceCents)}
            </span>
          </li>
        ))}
        <li className="space-y-1 bg-surface/40 p-4 text-[13px]">
          <div className="flex justify-between text-ink-muted">
            <span>{t('orderSubtotal')}</span>
            <span className="tabular-nums">{money(order.subtotalCents)}</span>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-brand-600">
              <span>{t('orderDiscount')}</span>
              <span className="tabular-nums">−{money(order.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-1 font-display text-[15px] font-semibold text-ink">
            <span>{t('colTotal')}</span>
            <span className="tabular-nums">{money(order.totalCents)}</span>
          </div>
        </li>
      </ul>

      {(order.providerOrderId || order.providerCaptureId) && (
        <>
          <h2 className="mt-8 font-display text-[15px] font-semibold text-ink">{t('orderPaypalIds')}</h2>
          <dl className="mt-3 grid gap-2 rounded-[var(--radius-card)] border border-line bg-white p-5 text-[12px] sm:grid-cols-[130px_minmax(0,1fr)]">
            {order.providerOrderId && (
              <>
                <dt className="text-ink-muted">{t('orderProviderOrder')}</dt>
                <dd className="font-mono break-all text-ink">{order.providerOrderId}</dd>
              </>
            )}
            {order.providerCaptureId && (
              <>
                <dt className="text-ink-muted">{t('orderProviderCapture')}</dt>
                <dd className="font-mono break-all text-ink">{order.providerCaptureId}</dd>
              </>
            )}
          </dl>
        </>
      )}

      {/* What the money actually bought. Read back from the entitlements rather
          than inferred from the lines, so a grant later revoked or wound back by
          a refund shows as it really stands. */}
      <h2 className="mt-8 font-display text-[15px] font-semibold text-ink">{t('orderGranted')}</h2>
      {order.granted.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-5 text-center text-[13px] text-ink-muted">
          {t('orderGrantedNone')}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {order.granted.map((g, index) => {
            const live = g.status === 'active' && new Date(g.expiresAt).getTime() > Date.now();
            return (
              <li key={`${g.label}-${index}`} className="flex flex-wrap items-center gap-3 p-4">
                <span className="min-w-0 flex-1 text-[13px] text-ink">{g.label}</span>
                <span className="text-[11px] text-ink-muted">
                  {t('entUntil')} {dateFmt.format(new Date(g.expiresAt))}
                </span>
                <StatusBadge
                  status={live ? 'paid' : 'cancelled'}
                  label={live ? t('entActive') : t('entCancelled')}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Button asChild variant="outline" size="md" className="mt-8">
        <Link href={`/admin/students/${order.userId}`}>{t('viewStudent')}</Link>
      </Button>
    </div>
  );
}
