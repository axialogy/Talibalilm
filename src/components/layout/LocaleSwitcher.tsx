'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, localeLabels, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Two locales, so this is a toggle rather than a menu — one tap instead of
 * open-then-pick.
 *
 * `usePathname` here is next-intl's, which returns the path *without* the
 * locale prefix. Passing that to its router with a new locale is what keeps
 * the visitor on the same page instead of dumping them on the home page.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const other = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          router.replace(pathname, { locale: other });
        });
      }}
      aria-label={`${t('changeLanguage')}: ${localeLabels[other]}`}
      lang={other}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-60',
        className,
      )}
    >
      <Languages className="size-4" aria-hidden="true" />
      {localeLabels[other]}
    </button>
  );
}
