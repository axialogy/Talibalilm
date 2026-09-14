import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, Award, GraduationCap, Layers, PlayCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { CourseCard } from '@/components/marketing/CourseCard';
import { EventsSection } from '@/components/marketing/EventsSection';
import { ReviewsSection } from '@/components/marketing/ReviewsSection';
import { listCourses } from '@/lib/data/courses';
import { listCursus } from '@/lib/data/commerce';
import { listEvents, listReviews } from '@/lib/data/site';
import { institut } from '@/lib/content/institut';
import type { Course } from '@/lib/content/types';
import { siteUrl } from '@/lib/env';

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
  const tCheckout = await getTranslations('checkout');
  const tMeta = await getTranslations('meta');

  const [courses, cursusList, events, reviews] = await Promise.all([
    listCourses(),
    listCursus(),
    listEvents(6),
    listReviews(6),
  ]);

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

      {/* L'institut en bref.

          The column of figures that used to sit beside this is gone. It was
          computed honestly from the catalogue, which is how it came to read
          "0 modules, 0 chapitres, 0 séances" — an accurate advertisement for
          having nothing. Numbers go back when there is something to count. */}
      <section className="py-16 sm:py-20">
        <div className="shell max-w-3xl text-center">
          <h2 className="font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
            {t('brief.title')}
          </h2>
          <p className="mt-6 text-sm leading-relaxed text-ink-muted">{t('brief.body')}</p>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">{t('brief.body2')}</p>

          <div className="mt-8">
            <Button asChild size="md" variant="goldOutline">
              <Link href="/courses">{t('featured.cta')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Actualités & événements. Renders nothing at all while the table is
          empty — a heading over an empty grid advertises that the institute has
          no news. The testimonials sit further down, after the three steps. */}
      <EventsSection events={events} locale={locale} />

      {/* Découvrez nos formations.

          Seven hard-coded disciplines used to sit here, most of them with no
          module behind them, while the real catalogue was shown again further
          down the page. One section now, and it shows what the school has
          actually published. */}
      {courses.length > 0 && (
        <section className="bg-surface/60 py-16 sm:py-20">
          <div className="shell">
            <h2 className="text-center font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
              {t('formations.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] leading-relaxed text-ink-muted">
              {t('formations.lead')}
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.slice(0, 6).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            <div className="mt-10 text-center">
              <Button asChild size="md" variant="gold">
                <Link href="/courses">{t('formations.cta')}</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Les cursus — the two ways through the school. */}
      {cursusList.length > 0 && (
        <section className="py-16 sm:py-20">
          <div className="shell">
            <h2 className="text-center font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
              {t('cursus.title')}
            </h2>
            <p lang="ar" dir="rtl" className="mt-2 text-center font-arabic text-2xl text-ink">
              {t('cursus.titleAr')}
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
                      {/* The same line the checkout shows on the same choice.
                          Said in both places on purpose: it is the difference
                          people actually ask about, and a visitor should not
                          have to reach the payment screen to learn it. */}
                      <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                        <Award className="size-3.5" aria-hidden="true" />
                        {tCheckout(
                          cursus.kind === 'approfondi'
                            ? 'certificationApprofondi'
                            : 'certificationModule',
                        )}
                      </p>
                      <div className="mt-5">
                        <Button asChild size="sm" variant="gold">
                          <Link href="/checkout">{t('cursus.cta')}</Link>
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

      {/* What students say, last before the closing band: it reads as the
          argument for taking the three steps above, rather than as an
          interruption between the news and the catalogue. Absent while no
          review is published. */}
      <ReviewsSection reviews={reviews} />

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
