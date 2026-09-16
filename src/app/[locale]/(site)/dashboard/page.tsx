import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { BookOpen, GraduationCap, Layers, ShieldCheck, Wrench } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PendingSpinner } from '@/components/ui/pending-spinner';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { CheckoutProfileForm } from '@/components/checkout/CheckoutProfileForm';
import { UpcomingClasses } from '@/components/live/UpcomingClasses';
import { requireViewer } from '@/lib/auth/guards';
import { daysRemaining, getCourseProgress, getEntitlements } from '@/lib/data/learning';
import { listCourses } from '@/lib/data/courses';
import { listCursus } from '@/lib/data/commerce';
import { avatarUrl, getStudentProfile } from '@/lib/data/profile';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { courseLessons } from '@/lib/content/types';
import { signOut } from '@/app/actions/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Mon espace.
 *
 * The student's own page: who they are, what they can open, and how far they
 * have got. It is laid out like a profile page rather than a list — a header
 * with the photo and the standing, then the classes and the courses, then the
 * enrolment details — because this is the one page a student returns to and it
 * should read as theirs.
 *
 * Everything is read through the ordinary client, so RLS decides what exists:
 * the courses are the ones they have opened, the access is the access they
 * hold, and the live classes are the ones their entitlements cover.
 */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!supabaseConfigured) redirect('/login');

  const viewer = await requireViewer();
  const t = await getTranslations('learn');
  const tNav = await getTranslations('nav');
  const tProfile = await getTranslations('profile');
  const tCourses = await getTranslations('courses');

  const [profile, entitlements, published, cursusList] = await Promise.all([
    getStudentProfile(),
    getEntitlements(),
    listCourses(),
    listCursus(),
  ]);

  const avatar = await avatarUrl(profile?.avatarKey ?? null);
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

  const openedIds = new Set((enrollments ?? []).map((e) => e.course_id));
  const opened = published.filter((c) => openedIds.has(c.id));
  const suggestions = published.filter((c) => !openedIds.has(c.id)).slice(0, 3);

  // How far each opened course has got. One read for every lesson the student
  // has a row for; courses with none simply show an empty bar.
  const openedLessons = opened.map((course) => courseLessons(course));
  const progress = await getCourseProgress(openedLessons.flat().map((lesson) => lesson.id));

  const displayName =
    profile?.firstName || profile?.lastName
      ? `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim()
      : viewer.fullName || viewer.email || tProfile('title');

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });

  const courseTitles = new Map(published.map((course) => [course.id, course.title]));
  const cursusTitles = new Map(cursusList.map((cursus) => [cursus.id, cursus.title]));

  return (
    <>
      {/* The header: photo, name, standing. It sits on the same wash as the
          rest of the site so the page still reads as part of the school. */}
      <section className="hero-wash border-b border-line">
        <div className="shell py-10 sm:py-12">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-start">
            <AvatarUpload avatarUrl={avatar} name={displayName} />

            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
                {displayName}
              </h1>
              {viewer.email && <p className="mt-1 text-sm text-ink-muted">{viewer.email}</p>}

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Badge variant="soft">
                  {viewer.role === 'admin'
                    ? t('roleAdmin')
                    : viewer.role === 'instructor'
                      ? t('roleInstructor')
                      : tProfile('roleStudent')}
                </Badge>
                {!isStaff && (
                  <Badge variant={hasAccess ? 'success' : 'muted'}>
                    {hasAccess ? t('membershipActive') : t('membershipNone')}
                  </Badge>
                )}
                {remaining !== null && (
                  <Badge variant="gold">{t('expiresIn', { days: remaining })}</Badge>
                )}
              </div>
            </div>

            <form action={signOut} className="shrink-0">
              <Button type="submit" variant="ghost" size="sm">
                <PendingSpinner />
                {tNav('logout')}
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-12">
        <div className="shell grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-10">
            {/* Live classes first when there are any: a room that is open now
                is the one thing on this page that is time-sensitive. */}
            <div className="empty:hidden">
              <UpcomingClasses locale={locale} />
            </div>

            <section>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
                <BookOpen className="size-4 text-brand-500" aria-hidden="true" />
                {tProfile('coursesTitle')}
              </h2>

              {opened.length > 0 ? (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {opened.map((course, index) => {
                    const lessons = openedLessons[index] ?? [];
                    const done = lessons.filter((lesson) => progress.has(lesson.id)).length;
                    const percent = lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0;
                    const first = lessons[0];
                    return (
                      <li
                        key={course.id}
                        className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-card"
                      >
                        <p className="font-display text-[15px] font-semibold text-ink">
                          {course.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                          {tCourses('card.lessons', { count: lessons.length })}
                        </p>

                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[11px] text-ink-muted">
                            <span>{tProfile('progress', { done, total: lessons.length })}</span>
                            <span className="tabular-nums">{percent}%</span>
                          </div>
                          <div
                            role="progressbar"
                            aria-valuenow={percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={course.title}
                            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface"
                          >
                            <span
                              className="block h-full rounded-full bg-brand-500 transition-[width] duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {first && (
                          <div className="mt-4">
                            <Button asChild size="sm" variant="outline">
                              <Link
                                href={`/dashboard/courses/${course.slug}/lessons/${first.id}`}
                              >
                                {done > 0 ? t('continue') : t('browseCourses')}
                              </Link>
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
                  {tProfile('coursesEmpty')}
                </p>
              )}

              {suggestions.length > 0 && (
                <div className="mt-6">
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
            </section>

            <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
              <h2 className="font-display text-xl font-semibold text-ink">
                {tProfile('detailsTitle')}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                {tProfile('detailsLead')}
              </p>
              <div className="mt-6">
                <CheckoutProfileForm
                  profile={profile}
                  email={viewer.email}
                  submitLabel={tProfile('saveDetails')}
                  savedLabel={tProfile('detailsSaved')}
                />
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            {/*
              Staff do not hold a subscription and are never asked to renew one.
              Their access comes from `is_staff()` in the policies, not from an
              entitlement, so a card offering the teacher a subscription to their
              own school was offering something that buys them nothing.
            */}
            {isStaff ? (
              <div className="rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 p-5">
                <div className="flex items-center gap-2">
                  <Wrench className="size-4 text-brand-600" aria-hidden="true" />
                  <p className="text-[13px] font-medium text-brand-700">
                    {viewer.role === 'admin' ? t('roleAdmin') : t('roleInstructor')}
                  </p>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-brand-700/80">
                  {t('staffCardBody')}
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/admin">{t('staffCardCta')}</Link>
                </Button>
              </div>
            ) : (
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
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {t('expiresIn', { days: remaining })}
                  </p>
                )}
                <Button
                  asChild
                  size="sm"
                  variant={hasAccess ? 'ghost' : 'primary'}
                  className="mt-4"
                >
                  <Link href="/checkout">
                    {hasAccess ? t('renew') : tCourses('detail.enrollCta')}
                  </Link>
                </Button>
              </div>
            )}

            <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
              <h2 className="font-display text-[15px] font-semibold text-ink">
                {tProfile('accessTitle')}
              </h2>

              {entitlements.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {entitlements.map((entitlement) => {
                    const name =
                      entitlement.scope === 'course'
                        ? courseTitles.get(entitlement.course_id ?? '')
                        : entitlement.scope === 'cursus'
                          ? cursusTitles.get(entitlement.cursus_id ?? '')
                          : null;
                    const scopeLabel =
                      entitlement.scope === 'course'
                        ? tProfile('accessCourse')
                        : entitlement.scope === 'cursus'
                          ? tProfile('accessCursus')
                          : tProfile('accessSite');

                    return (
                      <li
                        key={entitlement.id}
                        className="rounded-[var(--radius-input)] border border-line bg-surface/40 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600"
                            aria-hidden="true"
                          >
                            {entitlement.scope === 'cursus' ? (
                              <GraduationCap className="size-3.5" />
                            ) : (
                              <Layers className="size-3.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">
                              {name ?? scopeLabel}
                            </p>
                            <p className="text-[11px] text-ink-muted">
                              {name ? `${scopeLabel} — ` : ''}
                              {tProfile('accessUntil', {
                                date: dateFmt.format(new Date(entitlement.expires_at)),
                              })}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
                  {tProfile('accessEmpty')}
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
