import { useState, useEffect } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { ShoppingBag, Menu, X, QrCode } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n, type TranslationKey } from '@/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

const links: { to: string; key: TranslationKey }[] = [
  { to: '/shop', key: 'navShop' },
  { to: '/drops', key: 'navDrops' },
  { to: '/journal', key: 'navJournal' },
  { to: '/about', key: 'navAbout' },
  { to: '/contact', key: 'navContact' },
];

export function Navbar() {
  const { t } = useI18n();
  const { cartCount, settings } = useGlowStore();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // The header goes from transparent to frosted once the hero scrolls past.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock the page behind the open drawer.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-charcoal focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        {t('skipToContent')}
      </a>

      {settings.announcement.trim() && (
        <div className="relative overflow-hidden bg-charcoal text-white">
          <p className="px-4 py-2 text-center text-[11px] font-medium tracking-wide sm:text-xs">
            {settings.announcement}
          </p>
        </div>
      )}

      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-border/70 bg-background/85 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0" aria-label={settings.brandName}>
            <Logo brandName={settings.brandName} priority />
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {links.map(l => {
              const active = location.pathname.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    'relative rounded-lg px-3.5 py-2 text-sm transition-colors duration-200',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(l.key)}
                  {active && (
                    <span className="absolute inset-x-3.5 -bottom-0.5 h-px bg-charcoal/40" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <LanguageSwitcher className="hidden sm:inline-flex" />

            <Link
              to="/unlock"
              className="hidden rounded-full p-2.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground sm:inline-flex"
              aria-label={t('unlockTitle')}
              title={t('unlockTitle')}
            >
              <QrCode className="h-[18px] w-[18px]" />
            </Link>

            <Link
              to="/cart"
              className="relative rounded-full p-2.5 text-foreground transition-colors duration-200 hover:bg-secondary"
              aria-label={`${t('navCart')} (${cartCount})`}
            >
              <ShoppingBag className="h-[18px] w-[18px]" />
              {cartCount > 0 && (
                <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-charcoal px-1 text-[10px] font-semibold text-white">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="rounded-full p-2.5 text-foreground transition-colors duration-200 hover:bg-secondary lg:hidden"
              aria-label={open ? t('navClose') : t('navMenu')}
              aria-expanded={open}
            >
              {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            'absolute inset-0 bg-charcoal/25 backdrop-blur-sm transition-opacity duration-300',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            'absolute inset-x-0 top-0 origin-top bg-background px-6 pb-8 pt-24 shadow-lifted transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            open ? 'translate-y-0' : '-translate-y-full',
          )}
        >
          <div className="flex flex-col gap-1">
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3.5 font-display text-2xl transition-colors duration-200 hover:bg-secondary"
              >
                {t(l.key)}
              </Link>
            ))}
            <Link
              to="/unlock"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-3.5 text-sm text-muted-foreground transition-colors duration-200 hover:bg-secondary"
            >
              <QrCode className="h-4 w-4" />
              {t('unlockTitle')}
            </Link>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </>
  );
}
