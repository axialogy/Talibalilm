import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { BookOpen, ShieldCheck, Wrench } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/marketing/PageHero';
import { requireViewer } from '@/lib/auth/guards';
import { daysRemaining, getEntitlements } from '@/lib/data/learning';
import { listCourses } from '@/lib/data/courses';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { courseLessons } from '@/lib/content/types';
import { signOut } from '@/app/actions/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!supabaseConfigured) redirect('/login');

  const viewer = await requireViewer();
  const t = await getTranslations('learn');
  const tNav = await getTranslations('nav');
  const tCourses = await getTranslations('courses');

  const entitlements = await getEntitlements();
  const hasAccess = entitlements.length > 0;
  const remaining = daysRemaining(entitlements);
  const isStaff = viewer.role === 'instructor' || viewer.role === 'admin';

  // Courses this student has opened, most recent first. Enrolment is a
  // bookmark rather than a gate, so an empty list is normal for a new member.
  const supabase = await createClient();
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id, last_accessed_at')
    .order('last_accessed_at', { ascending: false })
    .limit(6);

  const published = await listCourses();
  const openedIds = new Set((enrollments ?? []).map((e) => e.course_id));
  const opened = published.filter((c) => openedIds.has(c.id));
  const suggestions = published.filter((c) => !openedIds.has(c.id)).slice(0, 3);

  return (
    <>
      <PageHero
        crumb={tNav('dashboard')}
        title={viewer.fullName || tNav('dashboard')}
        lead={viewer.email ?? undefined}
      />

      <section className="py-12">
        <div className="shell grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{t('myCourses')}</h2>

            {opened.length > 0 ? (
              <ul className="mt-5 space-y-3">
                {opened.map((course) => {
                  const lessons = courseLessons(course);
                  const first = lessons[0];
                  return (
                    <li
                      key={course.id}
                      className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-4"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
                        aria-hidden="true"
                      >
                        <BookOpen className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[15px] font-semibold text-ink">
                          {course.title}
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          {tCourses('card.lessons', { count: lessons.length })}
                        </p>
                      </div>
                      {first && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/courses/${course.slug}/lessons/${first.id}`}>
                            {t('continue')}
                          </Link>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-5 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
                {t('noCourses')}
              </p>
            )}

            {suggestions.length > 0 && (
              <div className="mt-8">
                <h3 className="text-[13px] font-medium text-ink">{t('browseCourses')}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((course) => (
                    <li key={course.id}>
                      <Link
                        href={`/courses/${course.slug}`}
                        className="inline-flex rounded-full border border-line px-4 py-2 text-xs text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-600"
                      >
                        {course.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className={hasAccess ? 'size-4 text-brand-500' : 'size-4 text-ink-muted'}
                  aria-hidden="true"
                />
                <p className="text-[13px] font-medium text-ink">
                  {hasAccess ? t('membershipActive') : t('membershipNone')}
                </p>
              </div>
              {remaining !== null && (
                <p className="mt-1 text-[11px] text-ink-muted">{t('expiresIn', { days: remaining })}</p>
              )}
              <Button asChild size="sm" variant={hasAccess ? 'ghost' : 'primary'} className="mt-4">
                <Link href="/pricing">{hasAccess ? t('renew') : tCourses('detail.enrollCta')}</Link>
              </Button>
            </div>

            {isStaff && (
              <div className="rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 p-5">
                <div className="flex items-center gap-2">
                  <Wrench className="size-4 text-brand-600" aria-hidden="true" />
                  <p className="text-[13px] font-medium text-brand-700">{viewer.role}</p>
                </div>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/admin/courses">{tCourses('title')}</Link>
                </Button>
              </div>
            )}

            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                {tNav('logout')}
              </Button>
            </form>
          </aside>
        </div>
      </section>
    </>
  );
}
