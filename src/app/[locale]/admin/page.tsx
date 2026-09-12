import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Receipt,
  Tag,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentViewer } from '@/lib/auth/guards';

/**
 * The overview.
 *
 * Three bands, in the order a person actually uses them: the things you do
 * every day (quick actions), the numbers that tell you the shop is alive
 * (stats), and the short list of what is left before it can take money
 * (checklist). Somebody opening this screen should be able to act without
 * first learning what "products" or "cursus" mean.
 *
 * Every read goes through the ordinary anon client, so `is_staff()` decides
 * what is visible. Nothing here uses the service role.
 */
export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const supabase = await createClient();
  const viewer = await currentViewer();
  const isAdmin = viewer?.role === 'admin';

  const count = async (table: 'courses' | 'products' | 'packs' | 'cursus' | 'profiles') => {
    const { count: n } = await supabase.from(table).select('*', { count: 'exact', head: true });
    return n ?? 0;
  };

  const [courses, products, packs, cursus, students] = await Promise.all([
    count('courses'),
    count('products'),
    count('packs'),
    count('cursus'),
    count('profiles'),
  ]);

  const { count: publishedCourses } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  const { count: livePrices } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  // Real payment readiness, without ever reading the secret back: the status
  // RPC reports only whether one is set, and an env-var override counts too.
  const payEnvOverride = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  const { data: payStatus } = await supabase.rpc('payment_settings_status');
  const ps = payStatus as unknown as { enabled?: boolean; has_secret?: boolean } | null;
  const paymentsReady = payEnvOverride || Boolean(ps?.enabled && ps?.has_secret);

  // The handful of things an office does again and again. Coupons are admin-only,
  // matching the RPC that would refuse an instructor anyway.
  const actions = [
    { key: 'qaOrders', desc: 'qaOrdersDesc', icon: Receipt, href: '/admin/orders', admin: false },
    { key: 'qaCourses', desc: 'qaCoursesDesc', icon: BookOpen, href: '/admin/courses', admin: false },
    { key: 'qaPricing', desc: 'qaPricingDesc', icon: Tag, href: '/admin/pricing', admin: false },
    { key: 'qaCoupons', desc: 'qaCouponsDesc', icon: Ticket, href: '/admin/coupons', admin: true },
  ].filter((a) => !a.admin || isAdmin);

  const stats = [
    { key: 'statCourses', value: `${publishedCourses ?? 0}/${courses}`, hint: 'statFraction', icon: BookOpen, href: '/admin/courses' },
    { key: 'statPrices', value: `${livePrices ?? 0}/${products}`, hint: 'statFraction', icon: Tag, href: '/admin/pricing' },
    { key: 'statPacks', value: String(packs), hint: null, icon: CreditCard, href: '/admin/packs' },
    { key: 'statCursus', value: String(cursus), hint: null, icon: GraduationCap, href: '/admin/cursus' },
    { key: 'statStudents', value: String(students), hint: null, icon: Users, href: '/admin/students' },
  ] as const;

  // What still stands between this and a working shop.
  const checks = [
    { key: 'checkCourses', done: (publishedCourses ?? 0) > 0, href: '/admin/courses' },
    { key: 'checkPrices', done: (livePrices ?? 0) > 0, href: '/admin/pricing' },
    { key: 'checkProgramme', done: cursus > 0, href: '/admin/cursus' },
    { key: 'checkPayments', done: paymentsReady, href: '/admin/payments' },
  ] as const;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">{t('overview')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        {t('overviewLead')}
      </p>

      {/* Everyday jobs, front and centre. */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">{t('quickActions')}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map(({ key, desc, icon: Icon, href }) => (
            <li key={key}>
              <Link
                href={href}
                className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span
                  className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-white"
                  aria-hidden="true"
                >
                  <Icon className="size-5" />
                </span>
                <span className="mt-3 flex items-center gap-1 font-medium text-ink">
                  {t(key)}
                  <ArrowRight className="size-3.5 text-brand-500 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </span>
                <span className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{t(desc)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* The numbers. */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">{t('statsTitle')}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map(({ key, value, hint, icon: Icon, href }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 transition-colors hover:border-brand-300"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"
                  aria-hidden="true"
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-xl font-semibold text-ink">{value}</span>
                  <span className="block text-[12px] text-ink-muted">
                    {t(key)}
                    {hint && <span className="text-ink-muted/70"> · {t(hint)}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">{t('checklist')}</h2>
        <ul className="mt-4 space-y-2">
          {checks.map(({ key, done, href }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 transition-colors hover:border-brand-300"
              >
                {done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0 text-gold-600" aria-hidden="true" />
                )}
                <span className="flex-1 text-[13px] text-ink">{t(key)}</span>
                <span
                  className={done ? 'text-[11px] font-medium text-brand-600' : 'text-[11px] font-medium text-gold-700'}
                >
                  {done ? t('checkDone') : t('checkTodo')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
          <Wallet className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t('checkPaymentsNote')}
        </p>
      </section>
    </div>
  );
}
