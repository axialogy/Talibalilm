'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Megaphone, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/**
 * The strip across the top of every page.
 *
 * Dismissible, and the dismissal is remembered against the TEXT rather than
 * against the bar. A visitor who closes "inscriptions ouvertes" has not asked
 * to be kept in the dark about the next announcement, so keying the memory to
 * the message means a new one comes back on its own — which is the whole point
 * of the school being able to edit it.
 *
 * `sessionStorage`, not `localStorage`: closing it is "I have read this now",
 * not a preference to carry for months. And it is read inside an effect, so
 * the server and the first client render agree and nothing flickers.
 */
export function AnnouncementBar({ text, href }: { text: string; href?: string }) {
  const t = useTranslations('common');
  const [dismissed, setDismissed] = useState(false);
  const key = `tal_ann_${hash(text)}`;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(key) === '1') setDismissed(true);
    } catch {
      // Private windows and blocked storage throw on access. The bar simply
      // stays up, which is the harmless direction to fail in.
    }
  }, [key]);

  if (text.trim() === '' || dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      // Nothing to do; it will reappear on the next page, which is fine.
    }
  };

  // The office may point the strip at one of our own pages or at anything at
  // all. next-intl's Link prefixes the locale, which is right for the first
  // and wrong for the second, so an absolute URL leaves through a plain
  // anchor instead of being rewritten into a path that does not exist.
  const external = /^https?:\/\//i.test(href ?? '');

  const body = (
    <span className="flex items-center justify-center gap-2 text-center">
      <Megaphone className="size-4 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );

  return (
    <div className="relative z-60 bg-brand-700 text-white">
      <div className="shell flex min-h-11 items-center justify-center py-2 pe-10 text-[13px] font-medium">
        {!href ? (
          body
        ) : external ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {body}
          </a>
        ) : (
          <Link href={href} className="underline-offset-4 hover:underline">
            {body}
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={close}
        aria-label={t('close')}
        className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * A short, stable key for a sentence.
 *
 * djb2. Not a security boundary — it only has to differ when the school edits
 * the announcement, so that a closed bar reopens for the new one.
 */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
