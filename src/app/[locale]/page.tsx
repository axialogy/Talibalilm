import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, CalendarClock, Layers, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { CourseCard } from '@/components/marketing/CourseCard';
import { listCourses } from '@/lib/data/courses';
import { institut } from '@/lib/content/institut';
import { siteUrl } from '@/lib/env';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  const tMeta = await getTranslations('meta');
  const tPricing = await getTranslations('pricing');
  const courses = (await listCourses()).slice(0, 6);

  // JSON-LD for the organisation. Course-level schema lives on the course
  // pages, where the data that fills it actually is.
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

  const reasons = [
    { key: 'reason1', Icon: CalendarClock },
    { key: 'reason2', Icon: Layers },
    { key: 'reason3', Icon: ShieldCheck },
  ] as const;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* Hero. Reaches up behind the header, which is sticky rather than
          fixed, so the two share one wash instead of meeting at a seam. */}
      <section className="hero-wash relative isolate -mt-18 overflow-hidden rounded-br-[72px] pt-18 lg:rounded-br-[140px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG, no optimisation to gain */}
        <img
          src="/media/hero-mosque.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-0 -end-[8%] h-full w-[72%] object-cover object-center opacity-40 [mask-image:linear-gradient(to_right,transparent,black_22%)] select-none sm:w-[60%] sm:opacity-60 lg:end-0 lg:w-[50%] lg:opacity-100"
        />

        <div className="shell relative pt-14 pb-24 sm:pt-16 sm:pb-28 lg:pt-20 lg:pb-36">
          <div className="max-w-xl lg:max-w-3xl">
            <p className="eyebrow">{t('hero.eyebrow')}</p>
            <h1 className="mt-5 font-display text-[clamp(2rem,5.2vw,3.125rem)] leading-[1.14] font-semibold tracking-[-0.03em] text-ink">
              {t('hero.title')}
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-muted">{t('hero.body')}</p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/courses">{t('hero.cta')}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">{t('hero.ctaSecondary')}</Link>
              </Button>
            </div>
          </div>
        </div>

        <div
          className="dot-grid pointer-events-none absolute start-0 bottom-6 h-24 w-40 text-ink/15 sm:h-32 sm:w-56"
          aria-hidden="true"
        />
      </section>

      {/* Catalogue */}
      <section className="py-16 sm:py-20">
        <div className="shell">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_auto] lg:items-center lg:gap-10">
            <h2 className="font-display text-[28px] leading-tight font-semibold text-ink sm:text-[34px]">
              {t('featured.title')}
            </h2>
            <div className="border-s-2 border-brand-500 ps-5 text-[13px] leading-relaxed text-ink-muted">
              <p>{t('featured.body')}</p>
              <p className="mt-3">{t('featured.body2')}</p>
            </div>
            <Button asChild variant="outline" className="justify-self-start lg:justify-self-end">
              <Link href="/courses">{t('featured.cta')}</Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface/60 py-16 sm:py-20">
        <div className="shell">
          <p className="eyebrow">{t('how.eyebrow')}</p>
          <h2 className="mt-4 max-w-xl font-display text-[28px] leading-tight font-semibold text-ink sm:text-[34px]">
            {t('how.title')}
          </h2>

          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <li key={n}>
                <span className="font-display text-3xl font-semibold text-brand-200">
                  {String(n).padStart(2, '0')}
                </span>
                <h3 className="mt-2 font-display text-[15px] font-semibold text-ink">
                  {t(`how.step${n}Title`)}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t(`how.step${n}Body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The dark band */}
      <section className="relative isolate overflow-hidden bg-brand-800">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity"
          style={{ backgroundImage: "url('/media/approach.webp')" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-linear-to-r from-brand-900/95 via-brand-800/90 to-brand-800/70"
          aria-hidden="true"
        />

        <div className="shell relative py-14 sm:py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14">
            <div className="grid gap-8 sm:grid-cols-3 sm:gap-7">
              {([1, 2, 3] as const).map((n) => (
                <div key={n}>
                  <span className="block h-0.5 w-12 rounded-full bg-brand-300" aria-hidden="true" />
                  <h3 className="mt-4 font-display text-base font-semibold text-white">
                    {t(`approach.point${n}Title`)}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/70">
                    {t(`approach.point${n}Body`)}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[var(--radius-card)] border border-white/15 bg-white/10 p-7 backdrop-blur-sm">
              <p className="text-[11px] font-medium tracking-[0.18em] text-brand-200 uppercase">
                {t('approach.eyebrow')}
              </p>
              <h3 className="mt-3 font-display text-[22px] leading-snug font-semibold text-white sm:text-2xl">
                {t('approach.title')}
              </h3>
              <Link
                href="/register"
                className="group mt-6 inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.12em] text-white uppercase transition-colors hover:text-brand-200"
              >
                <ArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
                {t('approach.cta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="shell grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow">{t('why.eyebrow')}</p>
            <h2 className="mt-4 font-display text-[28px] leading-tight font-semibold text-ink sm:text-[34px]">
              {t('why.title')}
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-muted">{t('why.body')}</p>
          </div>

          <ul className="space-y-7">
            {reasons.map(({ key, Icon }) => (
              <li key={key} className="flex gap-4">
                <span
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white"
                  aria-hidden="true"
                >
                  <Icon className="size-4" />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-semibold text-ink">{t(`why.${key}Title`)}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{t(`why.${key}Body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-surface/60 py-16 sm:py-20">
        <div className="shell flex flex-col items-start gap-6 rounded-[var(--radius-card)] border border-line bg-white p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">{tPricing('title')}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{tPricing('lead')}</p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link href="/pricing">{tPricing('cta')}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
