import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n, type TranslationKey } from '@/i18n';
import { ProductCard } from '@/components/shop/ProductCard';
import type { ProductCategory } from '@/types';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/shop/')({
  component: ShopPage,
});

type Filter = 'all' | ProductCategory;
type Sort = 'newest' | 'price-asc' | 'price-desc';

const FILTERS: { value: Filter; key: TranslationKey }[] = [
  { value: 'all', key: 'filterAll' },
  { value: 'tee', key: 'filterTee' },
  { value: 'hoodie', key: 'filterHoodie' },
  { value: 'crewneck', key: 'filterCrewneck' },
  { value: 'cap', key: 'filterCap' },
  { value: 'accessory', key: 'filterAccessory' },
];

const SORTS: { value: Sort; key: TranslationKey }[] = [
  { value: 'newest', key: 'sortNewest' },
  { value: 'price-asc', key: 'sortPriceLow' },
  { value: 'price-desc', key: 'sortPriceHigh' },
];

function ShopPage() {
  const { t } = useI18n();
  const { products } = useGlowStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');

  // Only offer a category chip when something in the catalog uses it.
  const availableFilters = useMemo(
    () => FILTERS.filter(f => f.value === 'all' || products.some(p => p.category === f.value)),
    [products],
  );

  const visible = useMemo(() => {
    const list = filter === 'all' ? [...products] : products.filter(p => p.category === filter);
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    // Sold-out pieces sink to the bottom whichever sort is active.
    return list.sort((a, b) => Number(b.inStock) - Number(a.inStock));
  }, [products, filter, sort]);

  return (
    <>
      <header className="relative isolate overflow-hidden border-b border-border grain">
        <div className="glow-mesh-soft animate-drift" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h1 className="font-display text-5xl sm:text-6xl">{t('shopTitle')}</h1>
          <p className="mt-4 max-w-lg text-muted-foreground text-pretty">{t('shopSubtitle')}</p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Filters + sort */}
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
            {availableFilters.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={cn(
                  'shrink-0 cursor-pointer rounded-full border px-4 py-2 text-sm transition-all duration-200',
                  filter === f.value
                    ? 'border-charcoal bg-charcoal text-white'
                    : 'border-border bg-background text-muted-foreground hover:border-charcoal/30 hover:text-foreground',
                )}
              >
                {t(f.key)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {t('resultsCount', { n: visible.length })}
            </span>
            <label htmlFor="sort" className="sr-only">
              {t('sortBy')}
            </label>
            <select
              id="sort"
              value={sort}
              onChange={e => setSort(e.target.value as Sort)}
              className="cursor-pointer rounded-full border border-border bg-background px-4 py-2 text-sm outline-none transition-colors hover:border-charcoal/30 focus:border-charcoal/40"
            >
              {SORTS.map(s => (
                <option key={s.value} value={s.value}>
                  {t(s.key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="py-24 text-center text-muted-foreground">{t('noProducts')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {visible.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
