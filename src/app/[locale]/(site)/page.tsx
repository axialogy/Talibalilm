import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, GraduationCap, Layers, PlayCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { CourseCard } from '@/components/marketing/CourseCard';
import { listCourses } from '@/lib/data/courses';
import { listCursus } from '@/lib/data/commerce';
import { institut } from '@/lib/content/institut';
import type { Course, CourseCategory } from '@/lib/content/types';
import { siteUrl } from '@/lib/env';

/** Every discipline the catalogue can carry, in the order the school lists them. */
const CATEGORIES: CourseCategory[] = [
  'aqida',
  'fiqh',
  'coran',
  'hadith',
  'tafsir',
  'langue',
  'histoire',
];

interface Preview {
  courseSlug: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
}

/** The free lessons, across the catalogue, that anyone may watch. */
function freeLessons(courses: Course[], limit: number): Preview[] {
  const found: Preview[] = [];
  for (const course of courses) {
    for (const chapter of course.modules) {
      for (const lesson of chapter.lessons) {
        if (!lesson.is_preview) continue;
        found.push({
          courseSlug: course.slug,
          courseTitle: course.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
        });
        if (found.length >= limit) return found;
      }
    }
  }
  return found;
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  const tCourses = await getTranslations('courses');
  const tMeta = await getTranslations('meta');

  const [courses, cursusList] = await Promise.all([listCourses(), listCursus()]);

  // Real counts, from the catalogue. A number on a homepage that nothing
  // computes is a number that goes stale the week after it is written.
  const chapters = courses.reduce((n, course) => n + course.modules.length, 0);
  const lessons = courses.reduce(
    (n, course) => n + course.modules.reduce((m, mod) => m + mod.lessons.length, 0),
    0,
  );

  const byCategory = new Map<CourseCategory, number>();
  for (const course of courses) {
    byCategory.set(course.category, (byCategory.get(course.category) ?? 0) + 1);
  }
  // Disciplines that actually have something to offer lead; the rest follow, so
  // the row still reads as the school's full field of study on a young
  // catalogue without pretending every one of them is open.
  const disciplines = [...CATEGORIES].sort(
    (a, b) => (byCategory.get(b) ?? 0) - (byCategory.get(a) ?? 0),
  );

  const previews = freeLessons(courses, 3);

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: tMeta('siteName'),
    description: tMeta('defaultDescription'),
    url: siteUrl(),
    email: institut.email,
    telephone: institut.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: institut.addressLines[0],
      addressLocality: 'Montereau-Fault-Yonne',
      postalCode: '77130',
      addressCountry: 'FR',
    },
  };

  const stats: [string, string][] = [
    [String(courses.length), t('brief.statModules')],
    [String(chapters), t('brief.statChapters')],
    [String(lessons), t('brief.statLessons')],
    [String(cursusList.length), t('brief.statCursus')],
    ['2', t('brief.statModes')],
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* Hero. Centred, with the Arabic name under the French one and a single
          gold call to action — the school's own opening. It reaches up behind
          the header, which is sticky rather than fixed, so the two share one
          wash instead of meeting at a seam. */}
      <section className="hero-wash relative isolate -mt-18 overflow-hidden pt-18">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG, no optimisation to gain */}
        <img
          src="/media/hero-mosque.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-25 select-none"
        />

        <div className="shell relative py-16 text-center sm:py-20 lg:py-28">
          <p className="text-[11px] font-medium tracking-[0.2em] text-gold-600 uppercase">
            {t('hero.eyebrow')}
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-[clamp(2rem,5.2vw,3.25rem)] leading-[1.12] font-semibold tracking-[-0.03em] text-ink">
            {t('hero.title')}
          </h1>
          <p lang="ar" dir="rtl" className="mt-4 font-arabic text-3xl text-gold-600 sm:text-4xl">
            {t('heroTitleAr')}
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            {t('hero.body')}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" variant="gold">
              <Link href="/courses">{t('hero.cta')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/register">{t('closing.primary')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* L'institut en bref — prose beside a column of real numbers. */}
      <section className="py-16 sm:py-20">
        <div className="shell grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 className="font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
              {t('brief.title')}
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-ink-muted">{t('brief.body')}</p>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">{t('brief.body2')}</p>

            <div className="mt-8">
              <Button asChild size="md" variant="goldOutline">
                <Link href="/courses">{t('featured.cta')}</Link>
              </Button>
            </div>
          </div>

          <dl className="divide-y divide-line border-s-2 border-gold-500 ps-6">
            {stats.map(([value, label]) => (
              <div key={label} className="py-4 first:pt-0 last:pb-0">
                <dt className="font-display text-[32px] leading-none font-semibold text-ink">
                  {value}
                </dt>
                <dd className="mt-1.5 text-[12px] tracking-[0.08em] text-ink-muted uppercase">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Découvrez nos formations — the disciplines, French and Arabic. */}
      <section className="bg-surface/60 py-16 sm:py-20">
        <div className="shell">
          <h2 className="text-center font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
            {t('formations.title')}
          </h2>
          <p lang="ar" dir="rtl" className="mt-2 text-center font-arabic text-2xl text-ink">
            {t('formations.titleAr')}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] leading-relaxed text-ink-muted">
            {t('formations.lead')}
          </p>

          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {disciplines.map((category) => (
              <li
                key={category}
                className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-6 text-center"
              >
                <p className="font-display text-[17px] font-semibold text-ink">
                  {tCourses(`category.${category}`)}
                </p>
                <p lang="ar" dir="rtl" className="mt-1 font-arabic text-xl text-gold-600">
                  {tCourses(`categoryAr.${category}`)}
                </p>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-muted">
                  {tCourses(`categoryBody.${category}`)}
                </p>
                <p className="mt-4 text-[11px] tracking-[0.08em] text-ink-muted uppercase">
                  {t('formations.count', { count: byCategory.get(category) ?? 0 })}
                </p>
                <div className="mt-5">
                  <Button asChild size="sm" variant="gold">
                    <Link href={`/courses?category=${category}`}>{t('formations.cta')}</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Les cursus — the two ways through the school. */}
      {cursusList.length > 0 && (
        <section className="py-16 sm:py-20">
          <div className="shell">
            <h2 className="text-center font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
              {t('events.title')}
            </h2>
            <p lang="ar" dir="rtl" className="mt-2 text-center font-arabic text-2xl text-ink">
              {t('events.titleAr')}
            </p>

            <ul className="mt-10 grid gap-6 md:grid-cols-2">
              {cursusList.map((cursus) => {
                const Icon = cursus.kind === 'approfondi' ? GraduationCap : Layers;
                return (
                  <li
                    key={cursus.id}
                    className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white"
                  >
                    <div className="flex items-center gap-4 bg-ink px-6 py-6 text-white">
                      <span
                        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-500"
                        aria-hidden="true"
                      >
                        <Icon className="size-6" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-[18px] font-semibold">{cursus.title}</h3>
                        {cursus.yearCount > 1 && (
                          <p className="mt-0.5 text-[12px] text-gold-300">
                            {tCourses('card.years', { count: cursus.yearCount })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-6">
                      <p className="text-[13px] leading-relaxed text-ink-muted">
                        {cursus.description || cursus.subtitle}
                      </p>
                      <div className="mt-5">
                        <Button asChild size="sm" variant="gold">
                          <Link href="/checkout">{t('events.cta')}</Link>
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* The catalogue itself */}
      {courses.length > 0 && (
        <section className="bg-surface/60 py-16 sm:py-20">
          <div className="shell">
            <h2 className="text-center font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
              {t('featured.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] leading-relaxed text-ink-muted">
              {t('featured.body')}
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.slice(0, 6).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            <div className="mt-10 text-center">
              <Button asChild size="md" variant="goldOutline">
                <Link href="/courses">{t('featured.cta')}</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* The free lessons. Real content, openly readable — `is_preview` is what
          the database itself uses to decide, so nothing here is a promise the
          lesson page will then refuse. */}
      {previews.length > 0 && (
        <section className="py-16 sm:py-20">
          <div className="shell">
            <h2 className="text-center font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
              {t('previews.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] leading-relaxed text-ink-muted">
              {t('previews.lead')}
            </p>

            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {previews.map((preview) => (
                <li
                  key={preview.lessonId}
                  className="rounded-[var(--radius-card)] border border-line bg-white p-6"
                >
                  <span
                    className="flex size-11 items-center justify-center rounded-full bg-gold-50 text-gold-600"
                    aria-hidden="true"
                  >
                    <PlayCircle className="size-5" />
                  </span>
                  <p className="mt-4 text-[11px] tracking-[0.08em] text-ink-muted uppercase">
                    {preview.courseTitle}
                  </p>
                  <h3 className="mt-1 font-display text-[16px] font-semibold text-ink">
                    {preview.lessonTitle}
                  </h3>
                  <Link
                    href={`/courses/${preview.courseSlug}`}
                    className="group mt-4 inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.1em] text-gold-700 uppercase transition-colors hover:text-gold-600"
                  >
                    {t('previews.cta')}
                    <ArrowRight
                      className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="bg-surface/60 py-16 sm:py-20">
        <div className="shell">
          <p className="text-center text-[11px] tracking-[0.18em] text-gold-600 uppercase">
            {t('how.eyebrow')}
          </p>
          <h2 className="mx-auto mt-4 max-w-xl text-center font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
            {t('how.title')}
          </h2>

          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gold-500 font-display text-lg font-semibold text-white">
                  {n}
                </span>
                <h3 className="mt-4 font-display text-[16px] font-semibold text-ink">
                  {t(`how.step${n}Title`)}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                  {t(`how.step${n}Body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing band */}
      <section className="relative isolate overflow-hidden bg-brand-900">
        <div className="shell relative py-16 text-center sm:py-20">
          <h2 className="mx-auto max-w-2xl font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-white">
            {t('closing.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/70">
            {t('closing.body')}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" variant="gold">
              <Link href="/register">{t('closing.primary')}</Link>
            </Button>
            <Link
              href="/courses"
              className="text-[12px] font-semibold tracking-[0.12em] text-white uppercase transition-colors hover:text-gold-300"
            >
              {t('closing.secondary')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
