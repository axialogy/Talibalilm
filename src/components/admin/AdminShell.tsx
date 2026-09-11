'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Tag,
  Wallet,
  X,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/utils';

/**
 * The admin shell: a fixed sidebar on a desk, a drawer on a phone.
 *
 * A Client Component only because the sidebar opens and closes and needs to
 * know the current route to mark it. Everything inside it stays a Server
 * Component, so the pages keep reading the database directly through RLS
 * rather than fetching from the browser.
 *
 * The nav is one array. Adding a screen is a line here, not a layout edit in
 * three places.
 */
const NAV = [
  { href: '/admin', icon: LayoutDashboard, key: 'navOverview', admin: false },
  { href: '/admin/courses', icon: BookOpen, key: 'courses', admin: false },
  { href: '/admin/cursus', icon: GraduationCap, key: 'cursusNav', admin: false },
  { href: '/admin/pricing', icon: Tag, key: 'pricing', admin: false },
  { href: '/admin/packs', icon: CreditCard, key: 'packs', admin: false },
  { href: '/admin/payments', icon: Wallet, key: 'payments', admin: true },
] as const;

export function AdminShell({
  children,
  name,
  role,
  isAdmin,
  title,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
  isAdmin: boolean;
  title: string;
}) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => !item.admin || isAdmin);

  // `/admin` would otherwise light up on every child route.
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label={title}>
      {items.map(({ href, icon: Icon, key }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors',
              active
                ? 'bg-brand-500 font-medium text-white'
                : 'text-ink-muted hover:bg-brand-50 hover:text-brand-700',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Desk: a column that stays put while the page scrolls. */}
      <aside className="hidden w-64 shrink-0 border-e border-line bg-surface/40 lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-5">
          <Link href="/" className="mb-7 block" aria-label={title}>
            <Logo src="/branding/logo-institut.svg" label={title} className="h-9 w-auto" />
          </Link>

          {nav}

          <div className="mt-auto border-t border-line pt-4">
            <p className="truncate text-[13px] font-medium text-ink">{name}</p>
            <p className="text-[11px] tracking-wide text-ink-muted uppercase">{role}</p>
            <Link
              href="/dashboard"
              className="mt-3 inline-block text-[12px] text-brand-600 underline-offset-4 hover:underline"
            >
              {t('backToSite')}
            </Link>
          </div>
        </div>
      </aside>

      {/* Phone: a bar that opens the same nav as a sheet. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('openMenu')}
            aria-expanded={open}
            className="rounded-lg p-2 text-ink transition-colors hover:bg-brand-50"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
        </div>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label={t('closeMenu')}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink/40"
            />
            <div className="absolute inset-y-0 start-0 w-72 bg-white p-5 shadow-lifted">
              <div className="mb-6 flex items-center justify-between">
                <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t('closeMenu')}
                  className="rounded-lg p-2 text-ink transition-colors hover:bg-brand-50"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              {nav}
              <div className="mt-6 border-t border-line pt-4">
                <p className="truncate text-[13px] font-medium text-ink">{name}</p>
                <p className="text-[11px] tracking-wide text-ink-muted uppercase">{role}</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  );
}
