'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Radio,
  Menu,
  Receipt,
  Ticket,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { Logo } from '@/components/layout/Logo';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

/**
 * The nav, in three plain groups instead of one long list. "Overview" stands
 * alone; everything an office does day to day is under "Sales"; everything that
 * builds the catalogue is under "Setup". The labels are what a non-technical
 * user scans first, so they name the job, not the table.
 */
const NAV = [
  {
    section: null,
    items: [{ href: '/admin', icon: LayoutDashboard, key: 'navOverview', admin: false }],
  },
  {
    section: 'navGroupSales',
    items: [
      { href: '/admin/orders', icon: Receipt, key: 'navOrders', admin: false },
      { href: '/admin/students', icon: Users, key: 'navStudents', admin: false },
      { href: '/admin/coupons', icon: Ticket, key: 'navCoupons', admin: true },
      { href: '/admin/payments', icon: Wallet, key: 'payments', admin: true },
    ],
  },
  {
    section: 'navGroupSetup',
    items: [
      { href: '/admin/courses', icon: BookOpen, key: 'courses', admin: false },
      { href: '/admin/live', icon: Radio, key: 'liveNav', admin: false },
      { href: '/admin/cursus', icon: GraduationCap, key: 'cursusNav', admin: false },
      { href: '/admin/packs', icon: CreditCard, key: 'packs', admin: false },
    ],
  },
] as const;

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
export function AdminShell({
  children,
  name,
  role,
  isAdmin,
  title,
  logoSrc,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
  isAdmin: boolean;
  title: string;
  /**
   * Resolved by the layout through `@/lib/artwork`. It cannot be resolved here:
   * that module reads the filesystem, and this is a Client Component. Passing
   * it in is what stopped the sidebar rendering the drawn placeholder while the
   * public site showed the school's real lockup.
   */
  logoSrc: string;
}) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // `/admin` would otherwise light up on every child route.
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.admin || isAdmin),
  })).filter((group) => group.items.length > 0);

  const nav = (
    <nav className="flex flex-col gap-4" aria-label={title}>
      {groups.map((group) => (
        <div key={group.section ?? 'top'} className="flex flex-col gap-0.5">
          {group.section && (
            <p className="px-3 pb-1 text-[10px] font-semibold tracking-wider text-ink-muted/70 uppercase">
              {t(group.section)}
            </p>
          )}
          {group.items.map(({ href, icon: Icon, key }) => {
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
        </div>
      ))}
    </nav>
  );

  // A real POST to the server action, so it works with JS off and clears the
  // session server-side rather than only in the browser.
  const signOutButton = (
    <form action={signOut}>
      <button
        type="submit"
        className="mt-3 inline-flex items-center gap-2 text-[12px] text-ink-muted transition-colors hover:text-red-600"
      >
        <LogOut className="size-3.5" aria-hidden="true" />
        {t('signOut')}
      </button>
    </form>
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Desk: a column that stays put while the page scrolls. */}
      <aside className="hidden w-64 shrink-0 border-e border-line bg-surface/40 lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-5">
          <Link href="/" className="mb-7 block" aria-label={title}>
            <Logo src={logoSrc} label={title} className="h-14 w-auto" sizes="220px" />
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
            <div className="mt-2 -ms-3">
              <LocaleSwitcher />
            </div>
            {signOutButton}
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
                <div className="mt-2 -ms-3">
                  <LocaleSwitcher />
                </div>
                {signOutButton}
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  );
}
