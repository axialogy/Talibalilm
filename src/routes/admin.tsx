import { useState, useEffect, useRef } from 'react';
import { createFileRoute, Link, Outlet, useLocation, Navigate } from '@tanstack/react-router';
import {
  LayoutDashboard, ShoppingBag, Package, Layers, Star, NotebookPen, QrCode,
  Users, Settings, LogOut, Menu, X, Bell, BellRing, ExternalLink, CloudOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import {
  subscribeToNewActivity, supabaseEnabled, supabaseConfigError, rowToOrder, reviewRowToReview,
  onWriteError,
} from '@/lib/supabaseSync';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { useI18n, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

const navItems: { to: string; key: TranslationKey; icon: React.ComponentType<{ className?: string }> }[] = [
  { to: '/admin', key: 'adminOverview', icon: LayoutDashboard },
  { to: '/admin/orders', key: 'adminOrders', icon: ShoppingBag },
  { to: '/admin/products', key: 'adminProducts', icon: Package },
  { to: '/admin/drops', key: 'adminDrops', icon: Layers },
  { to: '/admin/reviews', key: 'adminReviews', icon: Star },
  { to: '/admin/journal', key: 'adminJournal', icon: NotebookPen },
  { to: '/admin/unlocks', key: 'adminUnlocks', icon: QrCode },
  { to: '/admin/customers', key: 'adminCustomers', icon: Users },
  { to: '/admin/settings', key: 'adminSettings', icon: Settings },
];

function NotificationBell() {
  const { t } = useI18n();
  const {
    notifications, markNotificationsRead, pushNotification,
    ingestRemoteOrder, ingestRemoteReview, settings,
  } = useGlowStore();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter(n => !n.read).length;
  // "now" is captured when the panel opens, so the relative labels stay stable
  // across re-renders instead of being recomputed during render.
  const [openedAt, setOpenedAt] = useState(0);

  const timeAgo = (iso: string): string => {
    const mins = Math.floor((openedAt - new Date(iso).getTime()) / 60000);
    if (mins < 1) return t('justNow');
    if (mins < 60) return t('minutesAgo', { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('hoursAgo', { n: hours });
    return t('daysAgo', { n: Math.floor(hours / 24) });
  };

  // Ask once for desktop notification permission (admin side only).
  useEffect(() => {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    } catch {
      /* unsupported */
    }
  }, []);

  // One websocket, INSERT events only — no polling, no wasted egress.
  useEffect(() => {
    if (!supabaseEnabled()) return;
    return subscribeToNewActivity(
      row => {
        ingestRemoteOrder(rowToOrder(row));
        pushNotification({
          type: 'order',
          title: 'New order',
          body: `${row.customer_name} — ${Number(row.total).toLocaleString('fr-DZ')} ${settings.currency}`,
        });
      },
      row => {
        ingestRemoteReview(reviewRowToReview(row));
        pushNotification({
          type: 'review',
          title: 'New review awaiting approval',
          body: `${row.name} — ${row.product_name}`,
        });
      },
    );
  }, [pushNotification, ingestRemoteOrder, ingestRemoteReview, settings.currency]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(o => !o);
          if (!open) {
            setOpenedAt(Date.now());
            if (unread > 0) markNotificationsRead();
          }
        }}
        className="relative cursor-pointer rounded-lg p-2 transition-colors hover:bg-white/10"
        aria-label={t('notifications')}
      >
        {unread > 0 ? (
          <BellRing className="h-[18px] w-[18px] text-white" />
        ) : (
          <Bell className="h-[18px] w-[18px] text-white/50" />
        )}
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        /**
         * Fixed, not absolute. Anchored to the bell it was 320px wide inside a
         * 256px sidebar, so it hung off the edge of the screen and its content
         * was unreadable. Fixed positioning with a viewport-clamped width
         * cannot clip: below lg it sits just inside the screen edge, and from
         * lg it clears the docked sidebar. `start`/`inset-inline` keeps that
         * true in Arabic, where the sidebar is on the right.
         */
        <div className="fixed start-4 top-16 z-[60] max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-card shadow-lifted lg:start-[17rem] lg:top-20">
          <div className="flex items-center justify-between border-b border-border p-3">
            <span className="text-sm font-medium">{t('notifications')}</span>
            <span className="text-xs text-muted-foreground">{notifications.length}</span>
          </div>
          {notifications.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t('noNotifications')}</p>
          ) : (
            notifications.slice(0, 20).map(n => (
              <div
                key={n.id}
                className={cn('border-b border-border/60 p-3 last:border-0', !n.read && 'bg-secondary/50')}
              >
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Whether this build is actually talking to Supabase.
 *
 * Without it every change is written to localStorage and to nothing else —
 * the dashboard looks completely normal while the data never leaves the
 * browser. That failure is silent by nature, so it gets a permanent badge
 * rather than being left for someone to discover via an empty table.
 */
function ConnectionBadge() {
  // Silent while it works — a permanent "all good" banner is just furniture.
  // It only speaks up when saves are NOT reaching the database, which is the
  // failure that otherwise looks identical to everything working.
  if (supabaseEnabled()) return null;

  const problem = supabaseConfigError();

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-200/90">
      <CloudOff className="mt-px h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 leading-snug">
        <strong className="font-semibold">This browser only.</strong> Nothing you change here is
        saved anywhere else.
        {/* Naming the exact defect beats "check your config" — the usual cause
            is an invisible stray space in a dashboard field. */}
        {problem && <span className="mt-1 block break-words font-mono opacity-80">{problem}</span>}
      </span>
    </div>
  );
}

function AdminLayout() {
  const { t } = useI18n();
  const { session, logout, loadAdminData, settings } = useGlowStore();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Both of these have to render for a signed-out visitor: the reset route is
  // where Supabase's recovery link lands, and bouncing it to /admin/login would
  // discard the recovery tokens before the password could be changed.
  const isPublicAdminRoute =
    location.pathname === '/admin/login' || location.pathname === '/admin/reset';

  useEffect(() => {
    if (session.isAuthenticated) void loadAdminData();
  }, [session.isAuthenticated, loadAdminData]);

  // Surface rejected writes. Local state has already updated by this point, so
  // without a toast the admin would see a successful-looking save that never
  // reached the database.
  useEffect(
    () =>
      onWriteError(what =>
        toast.error(`Could not ${what}`, {
          description: 'Saved in this browser only. Check the console for details.',
        }),
      ),
    [],
  );

  if (!session.isAuthenticated) {
    return isPublicAdminRoute ? <Outlet /> : <Navigate to="/admin/login" />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <button
        type="button"
        onClick={() => setMobileOpen(o => !o)}
        className="fixed end-4 top-4 z-50 cursor-pointer rounded-lg bg-card p-2.5 shadow-soft lg:hidden"
        aria-label={mobileOpen ? t('close') : t('navMenu')}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        data-open={mobileOpen}
        className="dock-drawer fixed inset-y-0 start-0 z-40 flex w-64 shrink-0 flex-col bg-charcoal text-white transition-transform duration-300 lg:static"
      >
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-6 flex items-center justify-between gap-2">
            <Logo variant="light" brandName={settings.brandName} className="h-7 min-w-0 shrink" />
            <NotificationBell />
          </div>

          <ConnectionBadge />

          <LanguageSwitcher variant="light" className="mb-4" />

          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="mb-5 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            {t('viewWebsite')}
          </a>

          <nav className="space-y-0.5">
            {navItems.map(item => {
              // "/admin" must not stay highlighted on every child route.
              const active =
                item.to === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200',
                    active ? 'bg-white text-charcoal' : 'text-white/60 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium">
              {session.user?.name?.[0]?.toUpperCase() ?? 'A'}
            </span>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{session.user?.name ?? t('adminUser')}</p>
              <p className="truncate text-xs text-white/45">{session.user?.email}</p>
            </div>
          </div>
          <Link
            to="/"
            onClick={logout}
            className="flex cursor-pointer items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            {t('signOut')}
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-charcoal/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl p-5 pt-16 sm:p-8 lg:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
