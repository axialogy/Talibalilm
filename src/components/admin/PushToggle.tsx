'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { urlBase64ToUint8Array } from '@/lib/push/key';
import { savePushSubscription, removePushSubscription } from '@/app/actions/push';

/**
 * Turning phone notifications on for this device.
 *
 * Every state this can be in is said out loud, because the usual experience of
 * a push button that failed is that NOTHING happens — no error, no prompt, no
 * notification later, and no way to tell which of five causes it was. The five:
 * the browser has no push support, the site has no VAPID key configured, the
 * person denied permission once and the browser now refuses silently, the
 * subscription was made but not stored, or it is simply off.
 *
 * "This device", not "this account", is the honest framing: a subscription
 * belongs to one browser on one machine. Turning it on here does nothing for
 * the phone, which is why the copy says so.
 */

type State = 'loading' | 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on' | 'busy';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function PushToggle() {
  const t = useTranslations('admin');
  const [state, setState] = useState<State>('loading');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (!VAPID) {
      setState('unconfigured');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }

    let cancelled = false;
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.pushManager.getSubscription())
      .then((existing) => {
        if (!cancelled) setState(existing ? 'on' : 'off');
      })
      .catch(() => {
        if (!cancelled) setState('off');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setFailed(false);
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      // `subscribe` rejects if the worker is not yet active, which it briefly
      // is not on a first registration.
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        // Non-negotiable on every current browser: a push the user cannot see
        // is not allowed, and passing false here throws rather than degrading.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
      });

      const json = subscription.toJSON();
      const result = await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        userAgent: navigator.userAgent,
      });

      if (!result.ok) {
        // Storing failed, so the browser holds a subscription the server will
        // never send to. Undo it rather than leaving the button saying "on".
        await subscription.unsubscribe().catch(() => {});
        setFailed(true);
        setState('off');
        return;
      }
      setState('on');
    } catch {
      setFailed(true);
      setState('off');
    }
  }, []);

  const disable = useCallback(async () => {
    setFailed(false);
    setState('busy');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState('off');
    } catch {
      setFailed(true);
      setState('off');
    }
  }, []);

  if (state === 'loading') return null;

  const note =
    state === 'unsupported'
      ? t('pushUnsupported')
      : state === 'unconfigured'
        ? t('pushUnconfigured')
        : state === 'denied'
          ? t('pushDenied')
          : state === 'on'
            ? t('pushOnNote')
            : t('pushOffNote');

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        {state === 'on' ? (
          <BellRing className="size-4 text-brand-600" aria-hidden="true" />
        ) : state === 'denied' || state === 'unsupported' ? (
          <BellOff className="size-4 text-ink-muted" aria-hidden="true" />
        ) : (
          <Bell className="size-4 text-ink-muted" aria-hidden="true" />
        )}
        <p className="text-[13px] font-medium text-ink">{t('pushTitle')}</p>
      </div>

      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{note}</p>

      {(state === 'off' || state === 'on' || state === 'busy') && (
        <Button
          type="button"
          size="sm"
          variant={state === 'on' ? 'ghost' : 'primary'}
          className="mt-3"
          disabled={state === 'busy'}
          onClick={state === 'on' ? disable : enable}
        >
          {state === 'on' ? t('pushDisable') : t('pushEnable')}
        </Button>
      )}

      {failed && (
        <p role="alert" className="mt-2 text-[12px] text-red-600">
          {t('pushFailed')}
        </p>
      )}
    </div>
  );
}
