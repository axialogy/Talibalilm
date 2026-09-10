import { useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Banknote, ShoppingBag, Clock, Package, Star, QrCode } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { formatPrice } from '@/lib/pricing';
import { PageHeader, StatCard, TableWrap, Th, Td, EmptyRow, Pill } from '@/components/admin/AdminUI';
import { statusTone, statusKey } from '@/lib/orderStatus';

export const Route = createFileRoute('/admin/')({
  component: OverviewPage,
});

function OverviewPage() {
  const { t, locale } = useI18n();
  const { orders, products, reviews, unlocks } = useGlowStore();

  const stats = useMemo(() => {
    // Cancelled orders never counted as revenue.
    const billable = orders.filter(o => o.status !== 'cancelled');
    return {
      revenue: billable.reduce((sum, o) => sum + o.total, 0),
      orders: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      products: products.length,
      pendingReviews: reviews.filter(r => !r.published).length,
      scans: unlocks.reduce((sum, u) => sum + u.scans, 0),
    };
  }, [orders, products, reviews, unlocks]);

  /** Order count per day for the last 14 days, oldest first. */
  const chartData = useMemo(() => {
    const days: { date: string; label: string; orders: number; revenue: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
          day: 'numeric',
          month: 'short',
        }),
        orders: 0,
        revenue: 0,
      });
    }
    const index = new Map(days.map(d => [d.date, d]));
    for (const o of orders) {
      const key = o.createdAt.slice(0, 10);
      const day = index.get(key);
      if (!day) continue;
      day.orders += 1;
      if (o.status !== 'cancelled') day.revenue += o.total;
    }
    return days;
  }, [orders, locale]);

  /** Units sold per product, best first. */
  const topProducts = useMemo(() => {
    const counts = new Map<string, { name: string; units: number; revenue: number }>();
    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      for (const item of o.items) {
        const entry = counts.get(item.productId) ?? {
          name: item.productName,
          units: 0,
          revenue: 0,
        };
        entry.units += item.quantity;
        entry.revenue += item.total;
        counts.set(item.productId, entry);
      }
    }
    return [...counts.values()].sort((a, b) => b.units - a.units).slice(0, 5);
  }, [orders]);

  const recent = orders.slice(0, 6);
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <>
      <PageHeader title={t('adminOverview')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t('statRevenue')} value={formatPrice(stats.revenue)} icon={Banknote} />
        <StatCard label={t('statOrders')} value={stats.orders} icon={ShoppingBag} />
        <StatCard label={t('statPending')} value={stats.pending} icon={Clock} />
        <StatCard label={t('statProducts')} value={stats.products} icon={Package} />
        <StatCard label={t('statReviews')} value={stats.pendingReviews} icon={Star} />
        <StatCard label={t('statScans')} value={stats.scans} icon={QrCode} />
      </div>

      {/* Orders over time */}
      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">{t('salesOverTime')}</h2>
        <div className="mt-6 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b0a8be" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#b0a8be" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,26,26,.07)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'rgba(26,26,26,.45)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'rgba(26,26,26,.45)' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid rgba(26,26,26,.1)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
                formatter={(value: number, name) =>
                  name === 'revenue' ? [formatPrice(value), t('statRevenue')] : [value, t('statOrders')]
                }
              />
              <Area
                type="monotone"
                dataKey="orders"
                stroke="#b0a8be"
                strokeWidth={2}
                fill="url(#ordersFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Recent orders */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">{t('recentOrders')}</h2>
            <Link
              to="/admin/orders"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('viewAll')}
            </Link>
          </div>

          <TableWrap>
            <thead>
              <tr>
                <Th>{t('orderCustomer')}</Th>
                <Th>{t('orderTotal')}</Th>
                <Th>{t('orderStatus')}</Th>
                <Th>{t('orderDate')}</Th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <EmptyRow colSpan={4}>{t('noOrders')}</EmptyRow>
              ) : (
                recent.map(o => (
                  <tr key={o.id}>
                    <Td>
                      <span className="font-medium">{o.customerName}</span>
                      <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                        {o.id}
                      </span>
                    </Td>
                    <Td className="tabular-nums">{formatPrice(o.total)}</Td>
                    <Td>
                      <Pill tone={statusTone(o.status)}>{t(statusKey(o.status))}</Pill>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {dateFmt.format(new Date(o.createdAt))}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </section>

        {/* Best sellers */}
        <section>
          <h2 className="mb-4 font-display text-xl">{t('topProducts')}</h2>
          <div className="rounded-2xl border border-border bg-card p-5">
            {topProducts.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t('noData')}</p>
            ) : (
              <ul className="space-y-4">
                {topProducts.map((p, i) => {
                  const max = topProducts[0].units || 1;
                  return (
                    <li key={p.name}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">
                          <span className="me-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                          {p.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {p.units}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <span
                          className="block h-full rounded-full bg-lavender-400"
                          style={{ width: `${(p.units / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
