'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { beginPayPalCheckout, completePayPalCheckout } from '@/app/actions/pay';

/**
 * PayPal's own buttons, loaded in the page.
 *
 * The SDK needs the public client id and nothing else: `createOrder` asks our
 * server to open the order (which prices the basket from the catalogue and
 * returns PayPal's order id), and `onApprove` asks our server to capture it.
 * The amount and the secret never enter this file, and the browser only ever
 * sees an order id it is not trusted to invent.
 *
 * If the popup cannot open, PayPal falls back to the return_url the server
 * set — the same route the old redirect flow used, so both paths settle
 * identically.
 */

interface PayPalButtonsInstance {
  render: (target: HTMLElement) => Promise<void>;
  close?: () => void;
}

interface PayPalSdk {
  Buttons: (options: {
    style?: Record<string, string | number>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }) => PayPalButtonsInstance;
}

declare global {
  interface Window {
    paypal?: PayPalSdk;
  }
}

/** Action errors are keys; this resolves them to sentences in the reader's locale. */
const MESSAGE: Record<string, string> = {
  unavailable: 'payUnavailable',
  paypalRefused: 'payRefused',
  rateLimited: 'rateLimited',
  packExhausted: 'packExhausted',
  mixedCurrency: 'mixedCurrency',
  profileRequired: 'profileRequired',
  emptyBasket: 'emptyBasket',
  payMismatch: 'payMismatch',
  payNotCompleted: 'payNotCompleted',
  payUnexpected: 'payUnexpected',
};

const SCRIPT_ID = 'paypal-sdk';

export function PayPalButton({
  clientId,
  currency,
  locale,
}: {
  clientId: string;
  currency: string;
  locale: string;
}) {
  const t = useTranslations('checkout');
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const showError = useCallback((key: string) => {
    setError(t(MESSAGE[key] ?? 'payUnexpected'));
  }, [t]);

  const renderButtons = useCallback(() => {
    const target = container.current;
    if (!target || !window.paypal) return;

    // React strict mode mounts effects twice in development; clearing first
    // keeps a second set of buttons from stacking under the first.
    target.innerHTML = '';

    try {
      window.paypal
        .Buttons({
          style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'paypal', height: 48 },
          createOrder: async () => {
            setError(null);
            settled.current = false;
            const result = await beginPayPalCheckout();
            if (!result.ok) {
              showError(result.error);
              throw new Error(result.error);
            }
            // A coupon can take the basket to zero between the page rendering
            // and the button being pressed. Nothing to capture: the order is
            // already settled and the student goes to the confirmation.
            if (result.free) {
              settled.current = true;
              router.push(`/checkout/confirmation?order=${result.orderId}`);
              throw new Error('free');
            }
            return result.paypalOrderId;
          },
          onApprove: async (data) => {
            const result = await completePayPalCheckout(data.orderID);
            if (!result.ok) {
              showError(result.error);
              return;
            }
            settled.current = true;
            router.push(`/checkout/confirmation?order=${result.orderId}`);
          },
          onCancel: () => {
            if (!settled.current) setError(t('payCancelled'));
          },
          onError: () => {
            // The deliberate abort for the free branch is not an error to show.
            if (!settled.current) setError(t('payUnexpected'));
          },
        })
        .render(target)
        .catch(() => setFailed(true));
    } catch {
      // A synchronous refusal from the SDK (bad client id, blocked script) is
      // not a page error; the payment block reports it like any other outage.
      setFailed(true);
    }
  }, [router, showError, t]);

  useEffect(() => {
    let cancelled = false;
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const onLoad = () => {
      if (cancelled) return;
      setLoading(false);
      renderButtons();
    };
    const onError = () => {
      if (cancelled) return;
      setLoading(false);
      setFailed(true);
    };

    if (window.paypal) {
      setLoading(false);
      renderButtons();
      return;
    }

    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
        clientId,
      )}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons&locale=${
        locale === 'en' ? 'en_US' : 'fr_FR'
      }`;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    return () => {
      cancelled = true;
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
  }, [clientId, currency, locale, renderButtons]);

  return (
    <div>
      {loading && (
        <p className="flex items-center gap-2 text-[13px] text-ink-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('paypalOpening')}
        </p>
      )}

      <div ref={container} />

      {failed && (
        <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{t('payUnavailable')}</p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[12px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
