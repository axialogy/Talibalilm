import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { Product } from '@/types';
import { formatPrice, discountPercent } from '@/lib/pricing';
import { productImage, productImageCount } from '@/lib/productArt';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * A product tile. Hovering swaps to the next colourway, which doubles as the
 * "there is more than one of these" affordance without a carousel.
 */
export function ProductCard({
  product,
  className,
  priority = false,
}: {
  product: Product;
  className?: string;
  /** The first row of the grid should not lazy-load — it is the LCP. */
  priority?: boolean;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);

  const total = productImageCount(product);
  const primary = productImage(product, 0);
  const secondary = total > 1 ? productImage(product, 1) : null;
  const off = discountPercent(product);

  return (
    <Link
      to="/shop/$slug"
      params={{ slug: product.slug }}
      className={cn('group block', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="relative aspect-[5/6] overflow-hidden rounded-2xl bg-secondary">
        <img
          src={primary}
          alt={product.name}
          width={400}
          height={480}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
            secondary && hovered ? 'scale-105 opacity-0' : 'scale-100 opacity-100',
          )}
        />
        {secondary && (
          <img
            src={secondary}
            alt=""
            aria-hidden="true"
            width={400}
            height={480}
            loading="lazy"
            decoding="async"
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
              hovered ? 'scale-105 opacity-100' : 'scale-100 opacity-0',
            )}
          />
        )}

        {/* Badges */}
        <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
          {!product.inStock && (
            <span className="rounded-full bg-charcoal/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
              {t('soldOut')}
            </span>
          )}
          {product.inStock && off > 0 && (
            <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal backdrop-blur-sm">
              {t('save', { percent: off })}
            </span>
          )}
        </div>

        {/* Colourway swatches */}
        {product.colors.length > 1 && (
          <div className="absolute bottom-3 end-3 flex items-center gap-1">
            {product.colors.slice(0, 4).map(c => (
              <span
                key={c.hex}
                className="h-3 w-3 rounded-full border border-white/70 shadow-xs"
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[17px] leading-snug">{product.name}</h3>
          {product.tagline && (
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{product.tagline}</p>
          )}
        </div>
        <div className="shrink-0 text-end">
          <p className="text-sm font-medium tabular-nums">{formatPrice(product.price)}</p>
          {off > 0 && (
            <p className="text-xs text-muted-foreground line-through tabular-nums">
              {formatPrice(product.oldPrice!)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
