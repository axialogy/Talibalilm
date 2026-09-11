import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Tag,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * The overview.
 *
 * Counts, and a checklist of what is not finished yet. The point is that
 * somebody opening this screen can tell in five seconds whether the site is
 * ready to take a student's money — an admin panel that only lists links
 * makes you go and look.
 *
 * Every count comes through the ordinary anon client, so `is_staff()` decides
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

  const stats = [
    { key: 'statCourses', value: `${publishedCourses ?? 0}/${courses}`, icon: BookOpen, href: '/admin/courses' },
    { key: 'statPrices', value: `${livePrices ?? 0}/${products}`, icon: Tag, href: '/admin/pricing' },
    { key: 'statPacks', value: String(packs), icon: CreditCard, href: '/admin/packs' },
    { key: 'statCursus', value: String(cursus), icon: GraduationCap, href: '/admin/cursus' },
    { key: 'statStudents', value: String(students), icon: Users, href: '/admin' },
  ] as const;

  // What still stands between this and a working shop.
  const checks = [
    { key: 'checkCourses', done: (publishedCourses ?? 0) > 0, href: '/admin/courses' },
    { key: 'checkPrices', done: (livePrices ?? 0) > 0, href: '/admin/pricing' },
    { key: 'checkProgramme', done: cursus > 0, href: '/admin/cursus' },
    { key: 'checkPayments', done: false, href: '/admin/payments' },
  ] as const;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">{t('overview')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        {t('overviewLead')}
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(({ key, value, icon: Icon, href }) => (
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
                <span className="block text-[12px] text-ink-muted">{t(key)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

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
                <span className="text-[11px] text-ink-muted">
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
