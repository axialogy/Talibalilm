import { useState } from 'react';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { Check, Home, Store } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { formatPrice, deliveryFeeFor } from '@/lib/pricing';
import { wilayas, wilayaLabel } from '@/lib/wilayas';
import { MirrorText } from '@/components/MirrorText';
import type { Order } from '@/types';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/checkout')({
  component: CheckoutPage,
});

/**
 * Algerian phone numbers, however the buyer types them.
 *
 * Separators are stripped first, then the number is checked by shape:
 *   0XXXXXXXXX      10 digits, national form (mobile 05/06/07, landline 02x…)
 *   213XXXXXXXXX    12 digits, international form with or without a leading +
 * Anything else is rejected, so a typo does not turn into an undeliverable order.
 */
function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/[^\d]/g, '');
  if (/^0\d{9}$/.test(digits)) return true;
  return /^213\d{9}$/.test(digits);
}

function CheckoutPage() {
  const { t, locale } = useI18n();
  const { cart, cartSubtotal, settings, placeOrder, clearCart } = useGlowStore();

  const [placed, setPlaced] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<'home' | 'desk'>('home');
  const [form, setForm] = useState({ name: '', phone: '', wilaya: '', address: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const deliveryFee = deliveryFeeFor(cartSubtotal, method, settings);
  const total = cartSubtotal + deliveryFee;

  // Nothing to check out and nothing just placed → back to the cart.
  if (cart.length === 0 && !placed) return <Navigate to="/cart" />;

  if (placed) return <OrderSuccess order={placed} />;

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = t('requiredField');
    if (!form.phone.trim()) next.phone = t('requiredField');
    else if (!isValidPhone(form.phone)) next.phone = t('invalidPhone');
    if (!form.wilaya) next.wilaya = t('requiredField');
    if (!form.address.trim()) next.address = t('requiredField');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      // Move focus to the first field with a problem.
      const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
      return;
    }
    setSubmitting(true);
    const order = placeOrder(cart, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      wilaya: form.wilaya,
      address: form.address.trim(),
      deliveryMethod: method,
      notes: form.notes.trim() || undefined,
    });
    clearCart();
    setPlaced(order);
    setSubmitting(false);
  }

  const field = (
    id: keyof typeof form,
    label: string,
    type: 'text' | 'tel' = 'text',
    autoComplete?: string,
  ) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        dir={type === 'tel' ? 'ltr' : undefined}
        value={form[id]}
        onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
        aria-invalid={errors[id] ? 'true' : undefined}
        aria-describedby={errors[id] ? `${id}-error` : undefined}
        className={cn(
          'w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-colors',
          errors[id] ? 'border-destructive' : 'border-border focus:border-charcoal/40',
        )}
      />
      {errors[id] && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">
          {errors[id]}
        </p>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl sm:text-5xl">{t('checkoutTitle')}</h1>
      <p className="mt-3 text-muted-foreground">{t('checkoutSubtitle')}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            {field('name', t('fullName'), 'text', 'name')}
            {field('phone', t('phone'), 'tel', 'tel')}
          </div>

          <div>
            <label htmlFor="wilaya" className="mb-1.5 block text-sm font-medium">
              {t('wilaya')}
            </label>
            <select
              id="wilaya"
              value={form.wilaya}
              onChange={e => setForm(f => ({ ...f, wilaya: e.target.value }))}
              aria-invalid={errors.wilaya ? 'true' : undefined}
              aria-describedby={errors.wilaya ? 'wilaya-error' : undefined}
              className={cn(
                'w-full cursor-pointer rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-colors',
                errors.wilaya ? 'border-destructive' : 'border-border focus:border-charcoal/40',
              )}
            >
              <option value="">{t('selectWilaya')}</option>
              {wilayas.map(w => (
                <option key={w.code} value={wilayaLabel(w, locale)}>
                  {wilayaLabel(w, locale)}
                </option>
              ))}
            </select>
            {errors.wilaya && (
              <p id="wilaya-error" className="mt-1.5 text-xs text-destructive">
                {errors.wilaya}
              </p>
            )}
          </div>

          {field('address', t('address'), 'text', 'street-address')}

          {/* Delivery method */}
          <fieldset>
            <legend className="mb-2.5 text-sm font-medium">{t('deliveryMethod')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { value: 'home', label: t('deliveryHome'), fee: settings.deliveryHome, icon: Home },
                  { value: 'desk', label: t('deliveryDesk'), fee: settings.deliveryDesk, icon: Store },
                ] as const
              ).map(opt => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all duration-200',
                    method === opt.value
                      ? 'border-charcoal bg-secondary/60'
                      : 'border-border hover:border-charcoal/30',
                  )}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value={opt.value}
                    checked={method === opt.value}
                    onChange={() => setMethod(opt.value)}
                    className="sr-only"
                  />
                  <opt.icon className="h-4 w-4 shrink-0 text-charcoal/60" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {deliveryFeeFor(cartSubtotal, opt.value, settings) === 0
                        ? t('cartFreeDelivery')
                        : formatPrice(opt.fee)}
                    </span>
                  </span>
                  {method === opt.value && <Check className="h-4 w-4 shrink-0" />}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="notes" className="mb-1.5 block text-sm font-medium">
              {t('orderNotes')}
            </label>
            <textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={t('orderNotesPlaceholder')}
              className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-charcoal/40"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer rounded-full bg-charcoal px-8 py-4 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted disabled:opacity-60"
          >
            {submitting ? t('placingOrder') : `${t('placeOrder')} · ${formatPrice(total)}`}
          </button>
        </form>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-2xl">{t('orderSummary')}</h2>

            <ul className="mt-5 space-y-4">
              {cart.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <img
                    src={item.image}
                    alt=""
                    aria-hidden="true"
                    width={56}
                    height={68}
                    loading="lazy"
                    className="h-16 w-14 shrink-0 rounded-lg bg-secondary object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.size}
                      {item.color && ` · ${item.color}`} × {item.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums">{formatPrice(item.total)}</p>
                </li>
              ))}
            </ul>

            <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('cartSubtotal')}</dt>
                <dd className="tabular-nums">{formatPrice(cartSubtotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('cartDelivery')}</dt>
                <dd className="tabular-nums">
                  {deliveryFee === 0 ? t('cartFreeDelivery') : formatPrice(deliveryFee)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-base font-medium">
                <dt>{t('cartTotal')}</dt>
                <dd className="tabular-nums">{formatPrice(total)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function OrderSuccess({ order }: { order: Order }) {
  const { t } = useI18n();

  return (
    <div className="relative isolate overflow-hidden grain">
      <div className="glow-mesh-soft animate-drift" aria-hidden="true" />

      <div className="relative mx-auto max-w-lg px-4 py-28 text-center sm:px-6">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-charcoal">
          <Check className="h-7 w-7 text-white" />
        </span>

        <h1 className="mt-8 font-display text-4xl sm:text-5xl">{t('orderPlacedTitle')}</h1>
        <p className="mt-4 text-muted-foreground text-pretty">
          {t('orderPlacedBody', { phone: order.phone ?? '' })}
        </p>

        <div className="mt-9 rounded-2xl border border-border bg-card p-6 text-start">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('orderNumber')}</span>
            <span className="font-mono font-medium">{order.id}</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">{t('orderTotalLabel')}</span>
            <span className="text-lg font-medium tabular-nums">{formatPrice(order.total)}</span>
          </div>
        </div>

        <p className="mt-10 font-display text-xl italic text-charcoal/55">
          <MirrorText>{t('brandLine1')}</MirrorText>
        </p>

        <Link
          to="/shop"
          className="mt-10 inline-flex cursor-pointer items-center gap-2 rounded-full bg-charcoal px-7 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted"
        >
          {t('keepShopping')}
        </Link>
      </div>
    </div>
  );
}
