import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { formatPrice } from '@/lib/pricing';
import { tagKey, tagTone } from '@/lib/customerTags';
import { PageHeader, TableWrap, Th, Td, EmptyRow, inputClass, Pill } from '@/components/admin/AdminUI';
import { CUSTOMER_TAGS, type CustomerTag } from '@/types';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/customers')({
  component: CustomersPage,
});

function CustomersPage() {
  const { t, locale } = useI18n();
  const { customers, updateCustomer } = useGlowStore();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<CustomerTag | 'all'>('all');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = customers;

    if (tagFilter !== 'all') {
      list = list.filter(c => (c.tag ?? 'unrated') === tagFilter);
    }
    if (q) {
      list = list.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.wilaya ?? '').toLowerCase().includes(q),
      );
    }
    // Best customers first — that is the question this page answers.
    return [...list].sort((a, b) => b.totalSpent - a.totalSpent);
  }, [customers, query, tagFilter]);

  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <PageHeader title={t('adminCustomers')} subtitle={`${customers.length}`} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('search')}
          className={cn(inputClass, 'max-w-xs')}
        />
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-1">
          {(['all', ...CUSTOMER_TAGS] as const).map(value => (
            <button
              key={value}
              type="button"
              onClick={() => setTagFilter(value)}
              aria-pressed={tagFilter === value}
              className={cn(
                'shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition-all duration-200',
                tagFilter === value
                  ? 'border-charcoal bg-charcoal text-white'
                  : 'border-border bg-background text-muted-foreground hover:border-charcoal/30',
              )}
            >
              {value === 'all' ? t('allStatuses') : t(tagKey(value))}
            </button>
          ))}
        </div>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>{t('customerName')}</Th>
            <Th>{t('customerPhone')}</Th>
            <Th>{t('orderWilaya')}</Th>
            <Th>{t('customerOrders')}</Th>
            <Th>{t('customerSpent')}</Th>
            <Th>{t('customerTag')}</Th>
            <Th>{t('customerNote')}</Th>
            <Th>{t('customerSince')}</Th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <EmptyRow colSpan={8}>{t('noCustomers')}</EmptyRow>
          ) : (
            visible.map(c => {
              const tag = c.tag ?? 'unrated';
              return (
                <tr key={c.id} className={cn(tag === 'blocked' && 'bg-destructive/5')}>
                  <Td className="font-medium">
                    {c.name}
                    {/* A blocked buyer must be obvious at a glance, not just
                        readable in the dropdown. */}
                    {tag === 'blocked' && (
                      <span className="mt-1 block">
                        <Pill tone="bad">{t('tagBlocked')}</Pill>
                      </span>
                    )}
                  </Td>
                  <Td>
                    <a
                      href={`tel:${c.phone.replace(/\s/g, '')}`}
                      dir="ltr"
                      className="text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {c.phone}
                    </a>
                  </Td>
                  <Td className="text-muted-foreground">{c.wilaya}</Td>
                  <Td className="tabular-nums">{c.orders}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatPrice(c.totalSpent)}</Td>

                  <Td>
                    <label className="sr-only" htmlFor={`tag-${c.id}`}>
                      {t('customerTag')}
                    </label>
                    <select
                      id={`tag-${c.id}`}
                      value={tag}
                      onChange={e => updateCustomer(c.id, { tag: e.target.value as CustomerTag })}
                      className={cn(
                        'cursor-pointer rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-charcoal/40',
                        tagTone(tag) === 'bad'
                          ? 'border-destructive/40 text-destructive'
                          : 'border-border',
                      )}
                    >
                      {CUSTOMER_TAGS.map(value => (
                        <option key={value} value={value}>
                          {t(tagKey(value))}
                        </option>
                      ))}
                    </select>
                  </Td>

                  <Td>
                    <label className="sr-only" htmlFor={`note-${c.id}`}>
                      {t('customerNote')}
                    </label>
                    <input
                      id={`note-${c.id}`}
                      defaultValue={c.note ?? ''}
                      placeholder={t('customerNotePlaceholder')}
                      // Commit on blur rather than per keystroke, so each note
                      // is one write instead of one per character.
                      onBlur={e => {
                        const next = e.target.value.trim();
                        if (next !== (c.note ?? '')) updateCustomer(c.id, { note: next || undefined });
                      }}
                      className="w-40 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-charcoal/40"
                    />
                  </Td>

                  <Td className="whitespace-nowrap text-muted-foreground">
                    {dateFmt.format(new Date(c.joinedAt))}
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableWrap>
    </>
  );
}
