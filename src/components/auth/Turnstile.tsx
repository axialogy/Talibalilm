'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

/**
 * Cloudflare Turnstile, drawn by hand.
 *
 * Supabase enforces the anti-robot check once the school switches it on, but
 * it does not draw anything: the browser has to produce a token and post it
 * with the credentials. This is that half.
 *
 * Explicit rendering rather than the implicit `cf-turnstile` div, for one
 * reason that matters to every form here: a token is SINGLE USE. The action
 * consumes it, and a failed attempt — a wrong password, an address already
 * taken — comes back with the token already spent. Posting it again is
 * refused, so the person is told the anti-robot check failed for a reason
 * that has nothing to do with them. `reset()` is the fix, and resetting needs
 * the widget id, which only `render()` hands back.
 *
 * No package. The script is Cloudflare's own, loaded once per page, and the
 * token lands in a hidden input the existing `ActionForm` already serialises.
 *
 * Unset site key means no widget and no token — local development and CI run
 * without CAPTCHA enabled in Supabase, and drawing a widget against no secret
 * would be noise. Production has the key, and Supabase has the secret.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Only the three calls this file makes, typed rather than pulled in whole. */
interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileHandle {
  /** Clear the spent token and run a fresh challenge. */
  reset: () => void;
}

/**
 * One script tag per page, whatever the browser did to the first attempt.
 *
 * The promise is module-scoped so a second widget — there are three auth
 * forms, though never two on one page — waits on the same load instead of
 * injecting a duplicate.
 */
let scriptLoad: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoad) {
    scriptLoad = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('turnstile script failed to load'));
      document.head.appendChild(script);
    });
  }
  return scriptLoad;
}

export function Turnstile({ ref, className }: { ref?: Ref<TurnstileHandle>; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState('');

  const reset = useCallback(() => {
    setToken('');
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, []);

  useImperativeHandle(ref, () => ({ reset }), [reset]);

  useEffect(() => {
    if (!SITE_KEY) return;
    const element = container.current;
    if (!element) return;

    let mounted = true;
    loadScript()
      .then(() => {
        if (!mounted || !window.turnstile) return;
        widgetId.current = window.turnstile.render(element, {
          sitekey: SITE_KEY,
          callback: (value) => setToken(value),
          // Both of these mean "no usable token right now". Clearing the input
          // is honest: the form will submit without one and Supabase will say
          // so, rather than a stale token being spent twice.
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        });
      })
      .catch((cause: unknown) => {
        // Nothing to report to the visitor: the form still renders and the
        // refusal, when it comes, names itself. This line is for the log.
        console.error('[turnstile] script load failed:', cause);
      });

    return () => {
      mounted = false;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) return null;

  return (
    <div className={className}>
      <div ref={container} />
      {/*
        The token the server action reads. A hidden input rather than state
        lifted into each form, because `ActionForm` builds its FormData from
        the form element — anything named inside it travels, including this.
      */}
      <input type="hidden" name="captchaToken" value={token} readOnly />
    </div>
  );
}
