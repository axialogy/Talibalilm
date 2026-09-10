import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, QrCode, Sparkles, EyeOff, Feather } from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { ProductCard } from '@/components/shop/ProductCard';
import { MirrorText, MirrorToggle } from '@/components/MirrorText';
import type { TranslationKey } from '@/i18n';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/** The brand lines, cycled through the ticker. */
const TICKER_KEYS: TranslationKey[] = [
  'brandLine2',
  'brandLine4',
  'brandLine3',
  'brandLine5',
  'brandLine6',
  'brandLine1',
];

function HomePage() {
  const { t, dir } = useI18n();
  const { products, posts, settings } = useGlowStore();
  const [email, setEmail] = useState('');

  const featured = useMemo(() => {
    const flagged = products.filter(p => p.featured);
    return (flagged.length > 0 ? flagged : products).slice(0, 4);
  }, [products]);

  const latestPosts = useMemo(
    () => posts.filter(p => p.published).slice(0, 3),
    [posts],
  );

  return (
    <>
      {/* ---------------------------------------------------------- */}
      {/* Hero                                                        */}
      {/* ---------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden grain">
        <div className="glow-mesh animate-drift" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-32 lg:pt-24">
          <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <div className="animate-fade-in-up">
              <p className="eyebrow">{t('heroEyebrow')}</p>

              <h1 className="mt-5 font-display text-[clamp(2.75rem,8vw,5.25rem)] leading-[0.95] tracking-tight text-balance">
                {settings.brandName}
              </h1>

              <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-charcoal/70 text-pretty">
                {t('heroSubtitle')}
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  to="/shop"
                  className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-charcoal px-7 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted"
                >
                  {t('heroCta')}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 flip-rtl" />
                </Link>
                <Link
                  to="/journal"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-charcoal/15 bg-background/70 px-7 py-3.5 text-sm font-medium backdrop-blur transition-colors duration-300 hover:border-charcoal/35"
                >
                  {t('heroCtaSecondary')}
                </Link>
              </div>

              {/* The positioning line, mirrored — the idea stated as the product */}
              <p className="mt-12 font-display text-lg italic text-charcoal/45">
                <MirrorText>{t('brandPositioning')}</MirrorText>
              </p>
            </div>

            {/* The current drop, front and centre */}
            <div className="relative mx-auto w-full max-w-[17.5rem] sm:max-w-sm lg:max-w-md">
              {/* Pastel wash behind the garment — a black hoodie on a near-white
                  ground otherwise reads as a cut-out floating in nothing. */}
              <div
                className="pointer-events-none absolute inset-x-[-14%] top-[4%] h-[84%] rounded-[50%] bg-lavender-300/50 blur-3xl"
                aria-hidden="true"
              />

              <img
                src="/products/hoodie-keep-going-1100.webp"
                srcSet="/products/hoodie-keep-going-640.webp 640w, /products/hoodie-keep-going-1100.webp 1100w"
                sizes="(min-width: 1024px) 28rem, (min-width: 640px) 24rem, 17.5rem"
                alt="The Keep Going hoodie, its message printed in reverse so it reads in a mirror"
                width={1100}
                height={1423}
                fetchPriority="high"
                decoding="async"
                className="relative z-10 w-full animate-hero-bounce [filter:drop-shadow(0_28px_36px_rgb(26_26_26/0.28))]"
              />

              {/* Ground shadow, breathing in time with the bounce */}
              <div
                className="pointer-events-none absolute inset-x-[18%] bottom-[1%] z-0 h-5 animate-hero-shadow rounded-[50%] bg-charcoal blur-xl"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Ticker of brand lines                                       */}
      {/* ---------------------------------------------------------- */}
      <section
        className="overflow-hidden border-y border-border bg-charcoal py-4 text-white"
        aria-hidden="true"
      >
        <div
          className={`flex w-max ${dir === 'rtl' ? 'animate-marquee-rtl' : 'animate-marquee'}`}
        >
          {[0, 1].map(copy => (
            <div key={copy} className="flex shrink-0 items-center">
              {TICKER_KEYS.map(key => (
                <span key={`${copy}-${key}`} className="flex items-center">
                  <span className="whitespace-nowrap px-8 font-display text-lg italic text-white/85">
                    {t(key)}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-white/30" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* New in                                                      */}
      {/* ---------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t('featuredSubtitle')}</p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">{t('featuredTitle')}</h2>
          </div>
          <Link
            to="/shop"
            className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('viewAll')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 flip-rtl" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">
          {featured.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Reverse typography — the interactive mirror                 */}
      {/* ---------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden border-y border-border bg-secondary/50 grain">
        <div className="glow-mesh-soft animate-drift" aria-hidden="true" />

        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <p className="eyebrow">{t('mirrorSectionEyebrow')}</p>
          <h2 className="mx-auto mt-3 max-w-2xl font-display text-4xl text-balance sm:text-5xl">
            {t('mirrorSectionTitle')}
          </h2>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground text-pretty">
            {t('mirrorSectionBody')}
          </p>

          <div className="mirror-surface mx-auto mt-12 rounded-3xl px-6 py-14 shadow-glow sm:px-12">
            <MirrorToggle
              text={t('brandLine1')}
              showLabel={t('mirrorToggleShow')}
              hideLabel={t('mirrorToggleHide')}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Hidden QR                                                   */}
      {/* ---------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="eyebrow">{t('qrSectionEyebrow')}</p>
            <h2 className="mt-3 font-display text-4xl text-balance sm:text-5xl">
              {t('qrSectionTitle')}
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground text-pretty">
              {t('qrSectionBody')}
            </p>
            <Link
              to="/unlock"
              className="group mt-8 inline-flex cursor-pointer items-center gap-2 rounded-full bg-charcoal px-7 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted"
            >
              <QrCode className="h-4 w-4" />
              {t('qrSectionCta')}
            </Link>
          </div>

          {/* A care label with the QR on it */}
          <div className="mx-auto w-full max-w-sm">
            <div className="rotate-[-2deg] rounded-2xl border border-border bg-card p-7 shadow-lifted">
              <p className="text-[10px] font-medium uppercase tracking-widest2 text-muted-foreground">
                Care · Entretien
              </p>
              <div className="mt-4 flex items-center gap-5">
                <QrPlaceholder />
                <div className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
                  <p className="font-mono text-charcoal">SOFT-01</p>
                  <p className="mt-1">30° · no bleach</p>
                  <p>do not tumble dry</p>
                  <p className="mt-2 italic text-charcoal/50">scan me</p>
                </div>
              </div>
              <p className="mt-5 border-t border-border pt-4 font-display text-sm italic text-charcoal/60">
                <MirrorText>{t('brandLine3')}</MirrorText>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* How we make things                                          */}
      {/* ---------------------------------------------------------- */}
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <h2 className="font-display text-4xl sm:text-5xl">{t('valuesTitle')}</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { icon: Feather, title: t('value1Title'), body: t('value1Body') },
              { icon: EyeOff, title: t('value2Title'), body: t('value2Body') },
              { icon: Sparkles, title: t('value3Title'), body: t('value3Body') },
            ].map(v => (
              <div key={v.title} className="rounded-2xl border border-border bg-card p-7">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
                  <v.icon className="h-5 w-5 text-charcoal/70" />
                </span>
                <h3 className="mt-5 font-display text-xl">{v.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Journal teaser                                              */}
      {/* ---------------------------------------------------------- */}
      {latestPosts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{t('journalTeaserSubtitle')}</p>
              <h2 className="mt-2 font-display text-4xl sm:text-5xl">{t('journalTeaserTitle')}</h2>
            </div>
            <Link
              to="/journal"
              className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('journalAll')}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 flip-rtl" />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {latestPosts.map(post => (
              <Link
                key={post.id}
                to="/journal/$slug"
                params={{ slug: post.slug }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft"
              >
                {post.coverImage && (
                  <div className="aspect-[16/9] overflow-hidden bg-secondary">
                    <img
                      src={post.coverImage}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-7">
                  <span className="eyebrow">{post.tag}</span>
                  <h3 className="mt-3 font-display text-xl leading-snug">{post.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <span className="mt-5 text-xs text-muted-foreground">
                    {t('journalRead', { n: post.readMinutes })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- */}
      {/* Newsletter                                                  */}
      {/* ---------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden border-t border-border grain">
        <div className="glow-mesh-soft animate-drift" aria-hidden="true" />
        <div className="relative mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-4xl text-balance sm:text-5xl">{t('newsletterTitle')}</h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground text-pretty">
            {t('newsletterBody')}
          </p>

          <form
            className="mx-auto mt-9 flex max-w-md flex-col gap-3 sm:flex-row"
            onSubmit={e => {
              e.preventDefault();
              if (!email.trim()) return;
              toast.success(t('newsletterThanks'));
              setEmail('');
            }}
          >
            <label htmlFor="newsletter-email" className="sr-only">
              {t('newsletterPlaceholder')}
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('newsletterPlaceholder')}
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-5 py-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-charcoal/40"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-full bg-charcoal px-7 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted"
            >
              {t('newsletterCta')}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

/**
 * A decorative QR-looking block. It is deliberately not a scannable code —
 * real codes are generated per piece and live on the care label.
 */
function QrPlaceholder() {
  // Fixed pattern so it never re-shuffles between renders.
  const cells =
    '1110111010001011101110100010001110111010111010001011101110001010111011101';
  return (
    <div
      className="grid h-20 w-20 shrink-0 grid-cols-8 gap-[2px] rounded-lg bg-white p-1.5 shadow-xs"
      aria-hidden="true"
    >
      {Array.from({ length: 64 }).map((_, i) => (
        <span
          key={i}
          className={cells[i % cells.length] === '1' ? 'rounded-[1px] bg-charcoal' : ''}
        />
      ))}
    </div>
  );
}
