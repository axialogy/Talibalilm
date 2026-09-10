import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Check, Clock, GraduationCap, Lock, MapPin, PlayCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CourseArt } from '@/components/marketing/CourseArt';
import { CourseCard } from '@/components/marketing/CourseCard';
import { buildTimeCourseSlugs, getCourse, getInstructor, relatedCourses } from '@/lib/data/courses';
import { institut } from '@/lib/content/institut';
import { lessonCount } from '@/lib/content/types';
import { siteUrl } from '@/lib/env';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** Pre-render every course in every locale; ISR refreshes them hourly. */
/**
 * Seeded from the fixtures because this runs at build time, when the request
 * context RLS needs does not exist. `revalidate` below plus `dynamicParams`
 * means a course created later is rendered on first request and then cached —
 * so the admin does not have to redeploy to publish.
 */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    buildTimeCourseSlugs().map((slug) => ({ locale, slug })),
  );
}

export const dynamicParams = true;

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const course = await getCourse(slug);
  if (!course) return {};

  const t = await getTranslations({ locale, namespace: 'courses' });
  return {
    title: course.title,
    description: course.subtitle,
    alternates: {
      canonical: locale === routing.defaultLocale ? `/courses/${slug}` : `/${locale}/courses/${slug}`,
      languages: { fr: `/courses/${slug}`, ar: `/ar/courses/${slug}` },
    },
    openGraph: {
      type: 'article',
      title: course.title,
      description: course.subtitle,
      // Falls back to the site card until the school uploads cover art; the
      // generated SVG cover is inline markup, not a shareable URL.
      images: [{ url: course.cover_url ?? '/branding/og.png' }],
    },
    other: { 'course:level': t(`level.${course.level}`) },
  };
}

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const course = await getCourse(slug);
  if (!course || course.status !== 'published') notFound();

  const t = await getTranslations('courses');
  const tMeta = await getTranslations('meta');
  const tNav = await getTranslations('nav');
  const instructor = await getInstructor(course.instructor_id);
  const related = await relatedCourses(course);
  const lessons = lessonCount(course);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description,
    url: `${siteUrl()}${locale === routing.defaultLocale ? '' : `/${locale}`}/courses/${course.slug}`,
    inLanguage: course.language,
    provider: {
      '@type': 'EducationalOrganization',
      name: tMeta('siteName'),
      url: siteUrl(),
    },
    ...(instructor && { instructor: { '@type': 'Person', name: instructor.full_name } }),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: course.format === 'presentiel' ? 'onsite' : 'blended',
      courseWorkload: `P${course.duration_weeks}W`,
    },
    offers: {
      '@type': 'Offer',
      category: 'Subscription',
      price: (institut.annualPriceCents / 100).toFixed(2),
      priceCurrency: institut.currency,
      availability: 'https://schema.org/InStock',
    },
  };

  const facts = [
    { Icon: Clock, label: t('detail.facts.duration'), value: t('card.duration', { count: course.duration_weeks }) },
    { Icon: PlayCircle, label: t('detail.facts.lessons'), value: t('card.lessons', { count: lessons }) },
    { Icon: Clock, label: t('detail.facts.schedule'), value: course.schedule },
    { Icon: MapPin, label: t('detail.facts.format'), value: t(`format.${course.format}`) },
    { Icon: GraduationCap, label: t('detail.facts.level'), value: t(`level.${course.level}`) },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="hero-wash relative isolate -mt-18 overflow-hidden rounded-br-[56px] pt-18 lg:rounded-br-[110px]">
        <div className="shell relative py-14 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
            <div>
              <nav aria-label="fil d'ariane" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs">
                <Link href="/" className="text-ink-muted transition-colors hover:text-brand-600">
                  {tNav('home')}
                </Link>
                <span aria-hidden="true" className="text-ink-muted/60">/</span>
                <Link href="/courses" className="text-ink-muted transition-colors hover:text-brand-600">
                  {tNav('courses')}
                </Link>
                <span aria-hidden="true" className="text-ink-muted/60">/</span>
                <span className="text-ink">{course.title}</span>
              </nav>

              <p className="eyebrow">{t(`category.${course.category}`)}</p>

              <h1 className="mt-3 font-display text-[clamp(1.75rem,4.2vw,2.5rem)] leading-[1.15] font-semibold tracking-[-0.03em] text-ink">
                {course.title}
              </h1>
              <p lang="ar" dir="rtl" className="mt-2 font-arabic text-2xl text-gold-600">
                {course.title_ar}
              </p>

              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-muted">{course.subtitle}</p>

              {instructor && (
                <p className="mt-6 inline-flex items-center gap-2 text-xs text-ink-muted">
                  <span
                    className="flex size-6 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white"
                    aria-hidden="true"
                  >
                    {instructor.full_name.charAt(0)}
                  </span>
                  {instructor.full_name} · {instructor.role}
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-card">
              <div className="aspect-4/3">
                <CourseArt
                  titleAr={course.title_ar}
                  title={course.title}
                  kicker={t(`category.${course.category}`)}
                  tone={course.tone}
                />
              </div>

              <div className="p-6">
                <p className="text-xs text-ink-muted">{t('detail.membershipNote')}</p>
                <Button asChild block size="lg" className="mt-4">
                  <Link href="/checkout">{t('detail.enrollCta')}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="shell">
          <ul className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface/50 p-6 sm:grid-cols-3 lg:grid-cols-5">
            {facts.map(({ Icon, label, value }) => (
              <li key={label} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden="true" />
                <div>
                  <p className="text-[11px] tracking-[0.1em] text-ink-muted uppercase">{label}</p>
                  <p className="text-[13px] font-medium text-ink">{value}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">{t('detail.about')}</h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">{course.description}</p>

              <h2 className="mt-12 font-display text-2xl font-semibold text-ink">{t('detail.syllabus')}</h2>

              {/* The outline is public — it is the sales page. What is hidden
                  is the lesson body and its video, which live behind RLS and
                  are simply not in this payload. Nothing here is a disabled
                  link over a real URL. */}
              <ol className="mt-5 space-y-5">
                {course.modules.map((module, i) => (
                  <li
                    key={module.id}
                    className="rounded-[var(--radius-card)] border border-line bg-white p-6"
                  >
                    <p className="text-[11px] tracking-[0.14em] text-brand-600 uppercase">
                      {t('detail.module', { number: i + 1 })}
                    </p>
                    <h3 className="mt-1.5 font-display text-base font-semibold text-ink">{module.title}</h3>

                    <ul className="mt-4 divide-y divide-line">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-center gap-3 py-2.5">
                          {lesson.is_preview ? (
                            <PlayCircle className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
                          ) : (
                            <Lock className="size-4 shrink-0 text-ink-muted/50" aria-hidden="true" />
                          )}
                          <span
                            className={cn(
                              'flex-1 text-[13px]',
                              lesson.is_preview ? 'text-ink' : 'text-ink-muted',
                            )}
                          >
                            {lesson.title}
                          </span>
                          {lesson.is_preview ? (
                            <Badge variant="soft">{t('detail.previewBadge')}</Badge>
                          ) : (
                            <span className="sr-only">{t('detail.lockedLabel')}</span>
                          )}
                          <span className="text-[11px] text-ink-muted tabular-nums">
                            {formatMinutes(lesson.duration_seconds)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>

              <p className="mt-5 text-xs text-ink-muted">{t('detail.lockedHint')}</p>
            </div>

            <aside className="space-y-10">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">{t('detail.objectives')}</h2>
                <ul className="mt-5 space-y-3">
                  {course.objectives.map((objective) => (
                    <li key={objective} className="flex items-start gap-3 text-[13px] text-ink-muted">
                      <span
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                        aria-hidden="true"
                      >
                        <Check className="size-3" />
                      </span>
                      {objective}
                    </li>
                  ))}
                </ul>
              </div>

              {instructor && (
                <div className="rounded-[var(--radius-card)] border border-line bg-surface/50 p-6">
                  <h2 className="font-display text-lg font-semibold text-ink">{t('detail.instructor')}</h2>
                  <p className="mt-3 text-[13px] font-medium text-ink">{instructor.full_name}</p>
                  <p className="text-[11px] text-ink-muted">{instructor.role}</p>
                  <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{instructor.bio}</p>
                </div>
              )}
            </aside>
          </div>

          {related.length > 0 && (
            <div className="mt-16">
              <h2 className="font-display text-2xl font-semibold text-ink">{t('detail.related')}</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
