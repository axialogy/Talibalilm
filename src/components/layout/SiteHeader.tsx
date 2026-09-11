'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, Menu, Wrench, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { Logo } from '@/components/layout/Logo';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { Button } from '@/components/ui/button';
import { useViewer } from '@/components/layout/useViewer';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', key: 'home' },
  { href: '/courses', key: 'courses' },
  { href: '/pricing', key: 'pricing' },
] as const;

export function SiteHeader({ logoSrc }: { logoSrc: string }) {
  const t = useTranslations('nav');
  const tMeta = useTranslations('meta');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { signedIn, isStaff } = useViewer();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-60 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        {t('skipToContent')}
      </a>

      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-line/70 bg-white/85 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <nav className="shell flex h-18 items-center justify-between gap-4">
          <Link href="/" aria-label={tMeta('siteName')} className="shrink-0">
            <Logo priority src={logoSrc} label={tMeta('siteName')} />
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-[13px] transition-colors',
                  isActive(link.href) ? 'text-brand-600' : 'text-ink-muted hover:text-brand-600',
                )}
              >
                {t(link.key)}
                {isActive(link.href) && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-500" />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <LocaleSwitcher className="hidden sm:inline-flex" />

            {/* `signedIn === null` is the first paint, before the browser has
                read the session. Holding the space rather than guessing keeps
                the row from jumping under a cursor. */}
            {signedIn === null ? (
              <span aria-hidden="true" className="hidden h-9 w-44 sm:inline-flex" />
            ) : signedIn ? (
              <>
                {isStaff && (
                  <Link
                    href="/admin/courses"
                    className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[13px] text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-600 sm:inline-flex"
                  >
                    <Wrench className="size-3.5" aria-hidden="true" />
                    {t('admin')}
                  </Link>
                )}
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" aria-hidden="true" />
                    {t('dashboard')}
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-full px-3 py-2 text-[13px] text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-600 sm:inline-flex"
                >
                  {t('login')}
                </Link>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link href="/checkout">{t('startLearning')}</Link>
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="rounded-full p-2.5 text-ink transition-colors hover:bg-brand-50 lg:hidden"
              aria-label={open ? t('closeMenu') : t('openMenu')}
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>
      </header>

      <div
        id="mobile-nav"
        className={cn('fixed inset-0 z-40 lg:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')}
        aria-hidden={!open}
      >
        <div
          className={cn(
            'absolute inset-0 bg-ink/25 backdrop-blur-sm transition-opacity duration-300',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            'absolute inset-x-0 top-0 origin-top bg-white px-5 pt-24 pb-8 shadow-lifted transition-transform duration-300 sm:px-6',
            open ? 'translate-y-0' : '-translate-y-full',
          )}
        >
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-xl px-3 py-3 font-display text-lg transition-colors hover:bg-brand-50',
                  isActive(link.href) ? 'text-brand-600' : 'text-ink',
                )}
              >
                {t(link.key)}
              </Link>
            ))}
            {signedIn && isStaff && (
              <Link
                href="/admin/courses"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 font-display text-lg text-ink transition-colors hover:bg-brand-50"
              >
                {t('admin')}
              </Link>
            )}
            {!signedIn && (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 font-display text-lg text-ink transition-colors hover:bg-brand-50"
              >
                {t('login')}
              </Link>
            )}
          </div>

          <Button asChild block className="mt-5">
            {signedIn ? (
              <Link href="/dashboard" onClick={() => setOpen(false)}>
                {t('dashboard')}
              </Link>
            ) : (
              <Link href="/checkout" onClick={() => setOpen(false)}>
                {t('startLearning')}
              </Link>
            )}
          </Button>

          <div className="mt-4 border-t border-line pt-4">
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </>
  );
}
