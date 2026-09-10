import { Fragment, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Download, ChevronDown } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { formatPrice } from '@/lib/pricing';
import { ORDER_STATUSES, statusKey } from '@/lib/orderStatus';
import {
  PageHeader, TableWrap, Th, Td, EmptyRow, Pill, Btn, inputClass,
} from '@/components/admin/AdminUI';
import type { OrderStatus } from '@/types';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/orders')({
  component: OrdersPage,
});

function OrdersPage() {
  const { t, locale } = useI18n();
  const { orders, updateOrderStatus, settings } = useGlowStore();
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(o => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (!q) return true;
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.phone ?? '').includes(q)
      );
    });
  }, [orders, filter, query]);

  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  /**
   * CSV for the delivery company. Every field is quoted and internal quotes
   * doubled, so a comma in an address can never shift the columns.
   */
  function exportCsv() {
    const header = [
      'Order', 'Date', 'Customer', 'Phone', 'Wilaya', 'Address',
      'Delivery', 'Items', 'Subtotal', 'Delivery fee', 'Total', 'Status', 'Notes',
    ];
    const rows = visible.map(o => [
      o.id,
      new Date(o.createdAt).toISOString().slice(0, 10),
      o.customerName,
      o.phone ?? '',
      o.wilaya ?? '',
      o.address ?? '',
      o.deliveryMethod ?? '',
      o.items.map(i => `${i.productName} (${i.size}/${i.color}) x${i.quantity}`).join(' | '),
      String(o.subtotal),
      String(o.deliveryFee),
      String(o.total),
      o.status,
      o.notes ?? '',
    ]);

    const csv = [header, ...rows]
      .map(cells => cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    // BOM so Excel opens the Arabic and accented characters correctly.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grow-glow-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title={t('adminOrders')}
        subtitle={`${visible.length} / ${orders.length}`}
        actions={
          <Btn variant="ghost" onClick={exportCsv} disabled={visible.length === 0}>
            <Download className="h-4 w-4" />
            {t('exportCsv')}
          </Btn>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('search')}
          className={cn(inputClass, 'max-w-xs')}
        />
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-1">
          {(['all', ...ORDER_STATUSES] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={cn(
                'shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition-all duration-200',
                filter === s
                  ? 'border-charcoal bg-charcoal text-white'
                  : 'border-border bg-background text-muted-foreground hover:border-charcoal/30',
              )}
            >
              {s === 'all' ? t('allStatuses') : t(statusKey(s))}
            </button>
          ))}
        </div>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>{t('orderCustomer')}</Th>
            <Th>{t('orderWilaya')}</Th>
            <Th>{t('orderTotal')}</Th>
            <Th>{t('orderStatus')}</Th>
            <Th>{t('orderDate')}</Th>
            <Th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <EmptyRow colSpan={6}>{t('noOrders')}</EmptyRow>
          ) : (
            visible.map(o => (
              <Fragment key={o.id}>
                <tr>
                  <Td>
                    <span className="font-medium">{o.customerName}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                      {o.id}
                    </span>
                    {o.phone && (
                      <a
                        href={`tel:${o.phone.replace(/\s/g, '')}`}
                        dir="ltr"
                        className="mt-0.5 block text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {o.phone}
                      </a>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">{o.wilaya}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatPrice(o.total)}</Td>
                  <Td>
                    <label className="sr-only" htmlFor={`status-${o.id}`}>
                      {t('orderStatus')}
                    </label>
                    <select
                      id={`status-${o.id}`}
                      value={o.status}
                      onChange={e => updateOrderStatus(o.id, e.target.value as OrderStatus)}
                      className="cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-charcoal/40"
                    >
                      {ORDER_STATUSES.map(s => (
                        <option key={s} value={s}>
                          {t(statusKey(s))}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {dateFmt.format(new Date(o.createdAt))}
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                      aria-expanded={expanded === o.id}
                      aria-label={t('orderDetails')}
                      className="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-secondary"
                    >
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform duration-200',
                          expanded === o.id && 'rotate-180',
                        )}
                      />
                    </button>
                  </Td>
                </tr>

                {expanded === o.id && (
                  <tr>
                    <td colSpan={6} className="border-b border-border/60 bg-secondary/40 px-4 py-5">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                          <h3 className="eyebrow mb-2.5">{t('orderItems')}</h3>
                          <ul className="space-y-1.5 text-sm">
                            {o.items.map((i, idx) => (
                              <li key={idx} className="flex justify-between gap-3">
                                <span className="min-w-0">
                                  {i.productName}
                                  <span className="text-muted-foreground">
                                    {' '}
                                    · {i.size}
                                    {i.color && ` · ${i.color}`} × {i.quantity}
                                  </span>
                                </span>
                                <span className="shrink-0 tabular-nums">{formatPrice(i.total)}</span>
                              </li>
                            ))}
                          </ul>
                          <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">{t('cartSubtotal')}</dt>
                              <dd className="tabular-nums">{formatPrice(o.subtotal)}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">{t('cartDelivery')}</dt>
                              <dd className="tabular-nums">
                                {o.deliveryFee === 0
                                  ? t('cartFreeDelivery')
                                  : formatPrice(o.deliveryFee)}
                              </dd>
                            </div>
                            <div className="flex justify-between font-medium">
                              <dt>{t('cartTotal')}</dt>
                              <dd className="tabular-nums">{formatPrice(o.total)}</dd>
                            </div>
                          </dl>
                        </div>

                        <div>
                          <h3 className="eyebrow mb-2.5">{t('address')}</h3>
                          <p className="text-sm text-muted-foreground">{o.address}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{o.wilaya}</p>
                          <p className="mt-2 text-sm">
                            <Pill tone="neutral">
                              {o.deliveryMethod === 'desk' ? t('deliveryDesk') : t('deliveryHome')}
                            </Pill>
                          </p>
                          {o.notes && (
                            <>
                              <h3 className="eyebrow mb-2 mt-5">{t('orderNotes')}</h3>
                              <p className="text-sm text-muted-foreground">{o.notes}</p>
                            </>
                          )}
                          {o.phone && (
                            <a
                              href={`https://wa.me/${o.phone.replace(/[^\d]/g, '').replace(/^0/, '213')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-5 inline-block rounded-full border border-border bg-background px-4 py-2 text-xs transition-colors hover:border-charcoal/30"
                            >
                              WhatsApp · {settings.brandName}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))
          )}
        </tbody>
      </TableWrap>
    </>
  );
}
