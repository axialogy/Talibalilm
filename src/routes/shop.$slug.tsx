import { useMemo, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Share2, QrCode, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { formatPrice, computeTotal, unitPriceAt, discountPercent } from '@/lib/pricing';
import { productArtUri, productImage, productImageCount } from '@/lib/productArt';
import { MirrorText } from '@/components/MirrorText';
import { ReviewsSection } from '@/components/shop/ReviewsSection';
import { ProductCard } from '@/components/shop/ProductCard';
import type { Size } from '@/types';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/shop/$slug')({
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { products, addToCart } = useGlowStore();

  const product = products.find(p => p.slug === slug);

  const [imageIndex, setImageIndex] = useState(0);
  const [size, setSize] = useState<Size | null>(null);
  const [colorIndex, setColorIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  // The mirror on the product page starts reversed, exactly like the garment.
  const [mirrored, setMirrored] = useState(true);

  const related = useMemo(() => {
    if (!product) return [];
    return products
      .filter(p => p.id !== product.id && (p.dropId === product.dropId || p.category === product.category))
      .slice(0, 4);
  }, [products, product]);

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <h1 className="font-display text-4xl">404</h1>
        <p className="mt-3 text-muted-foreground">{t('noProducts')}</p>
        <Link
          to="/shop"
          className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-full bg-charcoal px-6 py-3 text-sm text-white"
        >
          {t('backToShop')}
        </Link>
      </div>
    );
  }

  const color = product.colors[colorIndex] ?? product.colors[0];
  const off = discountPercent(product);
  const lineTotal = computeTotal(product, quantity);
  const perUnit = unitPriceAt(product, quantity);
  const galleryCount = productImageCount(product);

  // The gallery follows the selected colourway when the art is generated.
  const heroImage =
    product.images.length > 0
      ? productImage(product, imageIndex)
      : productArtUri({
          category: product.category,
          color: color?.hex ?? '#e0cdc9',
          message: product.mirrorMessage,
          reversed: mirrored,
          seed: `${product.id}main`,
        });

  function handleAdd(thenCheckout = false) {
    if (!product) return;
    if (!size) {
      toast.error(t('chooseSizeFirst'));
      return;
    }
    addToCart({
      productId: product.id,
      productName: product.name,
      slug: product.slug,
      quantity,
      size,
      color: color?.name ?? '',
      unitPrice: product.price,
      total: computeTotal(product, quantity),
      image: productImage(product, 0),
    });
    if (thenCheckout) {
      void navigate({ to: '/cart' });
    } else {
      toast.success(t('addedToCart'));
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product!.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(t('linkCopied'));
    } catch {
      /* the visitor dismissed the sheet — nothing to report */
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/shop"
        className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5 flip-rtl" />
        {t('backToShop')}
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-16">
        {/* ---- Gallery ---- */}
        <div>
          <div className="relative overflow-hidden rounded-3xl bg-secondary">
            <img
              src={heroImage}
              alt={product.name}
              width={400}
              height={480}
              fetchPriority="high"
              decoding="async"
              className="aspect-[5/6] w-full object-cover"
            />

            {!product.inStock && (
              <span className="absolute start-4 top-4 rounded-full bg-charcoal/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                {t('soldOut')}
              </span>
            )}
            {product.inStock && off > 0 && (
              <span className="absolute start-4 top-4 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal backdrop-blur-sm">
                {t('save', { percent: off })}
              </span>
            )}

            {/* The mirror, on the product itself */}
            {product.mirrorMessage && product.images.length === 0 && (
              <button
                type="button"
                onClick={() => setMirrored(m => !m)}
                aria-pressed={!mirrored}
                className="absolute bottom-4 end-4 cursor-pointer rounded-full bg-white/85 px-4 py-2 text-xs font-medium text-charcoal backdrop-blur-sm transition-all duration-200 hover:bg-white"
              >
                {mirrored ? t('mirrorToggleShow') : t('mirrorToggleHide')}
              </button>
            )}
          </div>

          {/* Thumbnails — uploaded photos, or one per colourway */}
          {galleryCount > 1 && (
            <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
              {Array.from({ length: galleryCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setImageIndex(i);
                    if (product.images.length === 0) setColorIndex(i);
                  }}
                  aria-label={`${product.name} ${i + 1}`}
                  className={cn(
                    'shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-colors duration-200',
                    (product.images.length === 0 ? colorIndex : imageIndex) === i
                      ? 'border-charcoal'
                      : 'border-transparent hover:border-charcoal/25',
                  )}
                >
                  <img
                    src={productImage(product, i)}
                    alt=""
                    width={80}
                    height={96}
                    loading="lazy"
                    decoding="async"
                    className="h-24 w-20 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---- Buy panel ---- */}
        <div>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">{product.name}</h1>
          {product.tagline && <p className="mt-2 text-muted-foreground">{product.tagline}</p>}

          <div className="mt-6 flex items-end gap-3">
            <span className="text-2xl font-medium tabular-nums">{formatPrice(product.price)}</span>
            {off > 0 && (
              <span className="pb-0.5 text-base text-muted-foreground line-through tabular-nums">
                {formatPrice(product.oldPrice!)}
              </span>
            )}
          </div>

          {/* The reverse-printed line, shown the way it is printed */}
          {product.mirrorMessage && (
            <div className="mt-7 rounded-2xl border border-border bg-secondary/50 p-6">
              <p className="eyebrow">{t('mirrorMessageLabel')}</p>
              <p className="mt-2.5 font-display text-2xl italic">
                <MirrorText reversed={mirrored}>{product.mirrorMessage}</MirrorText>
              </p>
              {product.mirrorPlacement && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t('mirrorPlacementLabel')}: {product.mirrorPlacement}
                </p>
              )}
            </div>
          )}

          {/* Sizes */}
          <div className="mt-8">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-sm font-medium">{t('selectSize')}</span>
              {size && <span className="text-sm text-muted-foreground">{size}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  disabled={!product.inStock}
                  className={cn(
                    'min-w-[52px] cursor-pointer rounded-xl border px-4 py-2.5 text-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40',
                    size === s
                      ? 'border-charcoal bg-charcoal text-white'
                      : 'border-border bg-background hover:border-charcoal/35',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Colours */}
          {product.colors.length > 0 && (
            <div className="mt-7">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-sm font-medium">{t('selectColor')}</span>
                <span className="text-sm text-muted-foreground">{color?.name}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {product.colors.map((c, i) => (
                  <button
                    key={c.hex + i}
                    type="button"
                    onClick={() => {
                      setColorIndex(i);
                      if (product.images.length === 0) setImageIndex(i);
                    }}
                    aria-label={c.name}
                    aria-pressed={colorIndex === i}
                    title={c.name}
                    className={cn(
                      'relative h-10 w-10 cursor-pointer rounded-full border-2 transition-all duration-200',
                      colorIndex === i
                        ? 'border-charcoal'
                        : 'border-border hover:border-charcoal/35',
                    )}
                  >
                    <span
                      className="absolute inset-1 rounded-full"
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bundles */}
          {product.offers && product.offers.length > 0 && (
            <div className="mt-7 rounded-2xl border border-border p-5">
              <p className="eyebrow">{t('bundleOffers')}</p>
              <ul className="mt-3 space-y-1.5">
                {[...product.offers]
                  .sort((a, b) => a.qty - b.qty)
                  .map(o => (
                    <li key={o.qty}>
                      <button
                        type="button"
                        onClick={() => setQuantity(o.qty)}
                        className={cn(
                          'w-full cursor-pointer rounded-lg px-3 py-2 text-start text-sm transition-colors duration-200',
                          quantity === o.qty ? 'bg-secondary' : 'hover:bg-secondary/60',
                        )}
                      >
                        <span className="font-medium">
                          {t('bundleLine', { qty: o.qty, price: formatPrice(o.price) })}
                        </span>
                        <span className="ms-2 text-muted-foreground">
                          {t('eachAt', { price: formatPrice(o.price / o.qty) })}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Quantity + add */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-border">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                aria-label="−"
                className="cursor-pointer rounded-full p-3 transition-colors hover:bg-secondary"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(q => Math.min(99, q + 1))}
                aria-label="+"
                className="cursor-pointer rounded-full p-3 transition-colors hover:bg-secondary"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleAdd(false)}
              disabled={!product.inStock}
              className="flex-1 cursor-pointer rounded-full bg-charcoal px-8 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
            >
              {product.inStock ? `${t('addToCart')} · ${formatPrice(lineTotal)}` : t('soldOut')}
            </button>

            <button
              type="button"
              onClick={share}
              aria-label={t('shareProduct')}
              className="cursor-pointer rounded-full border border-border p-3.5 transition-colors duration-200 hover:border-charcoal/35"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {quantity > 1 && (
            <p className="mt-2.5 text-xs text-muted-foreground">
              {t('eachAt', { price: formatPrice(perUnit) })}
            </p>
          )}

          {product.inStock && (
            <button
              type="button"
              onClick={() => handleAdd(true)}
              className="mt-3 w-full cursor-pointer rounded-full border border-charcoal/20 px-8 py-3.5 text-sm font-medium transition-colors duration-300 hover:border-charcoal/45"
            >
              {t('buyNow')}
            </button>
          )}

          {/* Details */}
          <div className="mt-10 space-y-6 border-t border-border pt-8">
            <div>
              <h2 className="eyebrow">{t('productDetails')}</h2>
              <p className="mt-2.5 leading-relaxed text-muted-foreground text-pretty">
                {product.description}
              </p>
            </div>

            {product.material && (
              <div>
                <h2 className="eyebrow">{t('productMaterial')}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{product.material}</p>
              </div>
            )}

            {product.unlockCode && (
              <div className="rounded-2xl border border-border bg-secondary/40 p-5">
                <h2 className="eyebrow flex items-center gap-2">
                  <QrCode className="h-3.5 w-3.5" />
                  {t('unlockCodeLabel')}
                </h2>
                <p className="mt-2.5 font-mono text-lg tracking-wider">{product.unlockCode}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{t('unlockCodeHint')}</p>
                <Link
                  to="/unlock"
                  search={{ code: product.unlockCode }}
                  className="mt-3 inline-block text-sm underline underline-offset-4 transition-colors hover:text-foreground"
                >
                  {t('unlockCta')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-20">
        <ReviewsSection productId={product.id} productName={product.name} />
      </div>

      {related.length > 0 && (
        <section className="mt-20 border-t border-border pt-14">
          <h2 className="font-display text-3xl">{t('relatedTitle')}</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">
            {related.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
