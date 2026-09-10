import { Languages } from 'lucide-react';
import { useI18n, type Locale } from '@/i18n';
import { cn } from '@/lib/utils';

const LABELS: Record<Locale, string> = { en: 'EN', ar: 'عربي' };

/**
 * Two-state language toggle. `variant` picks the palette: `dark` for the
 * storefront's light chrome, `light` for the admin sidebar's dark chrome.
 */
export function LanguageSwitcher({
  variant = 'dark',
  className,
}: {
  variant?: 'dark' | 'light';
  className?: string;
}) {
  const { locale, setLocale, t } = useI18n();
  const locales: Locale[] = ['en', 'ar'];

  return (
    <div
      role="group"
      aria-label={t('language')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border p-0.5',
        variant === 'light' ? 'border-white/15 bg-white/5' : 'border-border bg-background/60',
        className,
      )}
    >
      <Languages
        className={cn(
          'ms-2 me-1 h-3.5 w-3.5 shrink-0',
          variant === 'light' ? 'text-white/45' : 'text-muted-foreground',
        )}
        aria-hidden="true"
      />
      {locales.map(l => {
        const active = locale === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200',
              active
                ? variant === 'light'
                  ? 'bg-white text-charcoal'
                  : 'bg-charcoal text-white'
                : variant === 'light'
                  ? 'text-white/60 hover:text-white'
                  : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
