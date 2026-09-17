import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import { Link } from '@/i18n/navigation';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AutoFilterForm } from '@/components/admin/AutoFilterForm';
import { formatPrice } from '@/lib/commerce/quote';
import { listOrders } from '@/lib/data/admin';
import type { OrderStatus } from '@/lib/supabase/database.types';
import { cap } from '@/lib/utils';
import { requireLocale } from '@/i18n/routing';

const STATUSES: OrderStatus[] = ['pending', 'paid', 'failed', 'refunded', 'cancelled'];
const METHODS = ['paypal', 'card', 'office', 'free'] as const;
type Method = (typeof METHODS)[number];

/**
 * Every payment, newest first — the screen the office opens to answer "did it
 * go through". Filters live in the URL so a filtered view is a shareable link.
 */
export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; method?: string; since?: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  const { status, method, since } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const validStatus = STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  const validMethod = METHODS.includes(method as Method) ? (method as Method) : undefined;
  const orders = await listOrders({ status: validStatus, method: validMethod, since });
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div>
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('ordersTitle')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t('ordersLead')}</p>

      {/* No submit button: picking a value applies the filter. The status
          filter is gone too — the office asked for the method instead, and a
          filter that only ever narrows by one thing is one thing to explain. */}
      <AutoFilterForm className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">
            {t('filterMethod')}
          </span>
          <select
            name="method"
            defaultValue={validMethod ?? ''}
            className="rounded-[var(--radius-input)] border border-line bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">{t('filterAllMethods')}</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`route${cap(m)}` as 'routePaypal')}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">{t('filterSince')}</span>
          <input
            type="date"
            name="since"
            defaultValue={since ?? ''}
            className="rounded-[var(--radius-input)] border border-line bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
      </AutoFilterForm>

      {orders.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
          {t('ordersEmpty')}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface/60 text-left text-[11px] tracking-wide text-ink-muted uppercase">
                <th className="p-3 font-medium">{t('colDate')}</th>
                <th className="p-3 font-medium">{t('colStudent')}</th>
                <th className="p-3 font-medium">{t('colStatus')}</th>
                <th className="p-3 font-medium">{t('colRoute')}</th>
                <th className="p-3 text-right font-medium">{t('colTotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id} className="transition-colors hover:bg-brand-50/40">
                  <td className="p-3 whitespace-nowrap">
                    <Link href={`/admin/orders/${o.id}`} className="text-ink hover:text-brand-600">
                      {dateFmt.format(new Date(o.createdAt))}
                    </Link>
                  </td>
                  <td className="p-3 text-ink-muted">{o.email ?? '—'}</td>
                  <td className="p-3">
                    <StatusBadge status={o.status} label={t(`status${cap(o.status)}` as 'statusPaid')} />
                  </td>
                  <td className="p-3 text-ink-muted">
                    {/* The route says which flow; the method says whether
                        PayPal's card or the balance funded it. */}
                    {o.route === 'paypal' && o.paymentMethod === 'card'
                      ? t('routeCard')
                      : t(`route${cap(o.route)}` as 'routePaypal')}
                  </td>
                  <td className="p-3 text-right font-medium text-ink tabular-nums">
                    {formatPrice(o.totalCents, locale, o.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
