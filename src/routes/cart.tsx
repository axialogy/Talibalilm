import { createFileRoute, Link } from '@tanstack/react-router';
import { Trash2, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { formatPrice, deliveryFeeFor } from '@/lib/pricing';

export const Route = createFileRoute('/cart')({
  component: CartPage,
});

function CartPage() {
  const { t } = useI18n();
  const { cart, updateCartQuantity, removeFromCart, cartSubtotal, settings } = useGlowStore();

  // The cart quotes home delivery; the checkout step lets them switch to desk.
  const estimatedDelivery = deliveryFeeFor(cartSubtotal, 'home', settings);
  const freeDeliveryActive = settings.freeDeliveryOver > 0;
  const remainingForFree = settings.freeDeliveryOver - cartSubtotal;

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-32 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
          <ShoppingBag className="h-7 w-7 text-charcoal/40" />
        </span>
        <h1 className="mt-7 font-display text-4xl">{t('cartTitle')}</h1>
        <p className="mt-3 text-muted-foreground">{t('cartEmpty')}</p>
        <Link
          to="/shop"
          className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-full bg-charcoal px-7 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted"
        >
          {t('cartEmptyCta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl sm:text-5xl">{t('cartTitle')}</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Lines */}
        <ul className="divide-y divide-border border-y border-border">
          {cart.map((item, i) => (
            <li key={`${item.productId}-${item.size}-${item.color}-${i}`} className="flex gap-4 py-6">
              <Link
                to="/shop/$slug"
                params={{ slug: item.slug }}
                className="shrink-0 overflow-hidden rounded-xl bg-secondary"
              >
                <img
                  src={item.image}
                  alt={item.productName}
                  width={96}
                  height={116}
                  loading="lazy"
                  decoding="async"
                  className="h-28 w-24 object-cover"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/shop/$slug"
                      params={{ slug: item.slug }}
                      className="font-display text-lg leading-snug transition-colors hover:text-charcoal/70"
                    >
                      {item.productName}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.size}
                      {item.color && ` · ${item.color}`}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums">
                    {formatPrice(item.total)}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-full border border-border">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(i, item.quantity - 1)}
                      aria-label="−"
                      className="cursor-pointer rounded-full p-2.5 transition-colors hover:bg-secondary"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[2rem] text-center text-sm tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(i, item.quantity + 1)}
                      aria-label="+"
                      className="cursor-pointer rounded-full p-2.5 transition-colors hover:bg-secondary"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(i)}
                    className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('cartRemove')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-2xl">{t('orderSummary')}</h2>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('cartSubtotal')}</dt>
                <dd className="tabular-nums">{formatPrice(cartSubtotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('cartDelivery')}</dt>
                <dd className="tabular-nums">
                  {estimatedDelivery === 0 ? t('cartFreeDelivery') : formatPrice(estimatedDelivery)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-base font-medium">
                <dt>{t('cartTotal')}</dt>
                <dd className="tabular-nums">{formatPrice(cartSubtotal + estimatedDelivery)}</dd>
              </div>
            </dl>

            {freeDeliveryActive && remainingForFree > 0 && (
              <div className="mt-5 rounded-xl bg-secondary/70 p-3.5">
                <p className="text-xs text-muted-foreground">
                  {t('freeDeliveryHint', { amount: formatPrice(settings.freeDeliveryOver) })}
                </p>
                <div
                  className="mt-2.5 h-1 overflow-hidden rounded-full bg-charcoal/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={settings.freeDeliveryOver}
                  aria-valuenow={Math.min(cartSubtotal, settings.freeDeliveryOver)}
                >
                  <span
                    className="block h-full rounded-full bg-charcoal/50 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (cartSubtotal / settings.freeDeliveryOver) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <Link
              to="/checkout"
              className="mt-6 block cursor-pointer rounded-full bg-charcoal px-8 py-3.5 text-center text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted"
            >
              {t('checkout')}
            </Link>

            <Link
              to="/shop"
              className="mt-3 block cursor-pointer rounded-full border border-border px-8 py-3.5 text-center text-sm transition-colors duration-300 hover:border-charcoal/35"
            >
              {t('continueShopping')}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
