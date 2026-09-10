import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { productImage } from '@/lib/productArt';
import { MirrorText } from '@/components/MirrorText';

export const Route = createFileRoute('/drops/')({
  component: DropsPage,
});

function DropsPage() {
  const { t, locale } = useI18n();
  const { drops, products } = useGlowStore();

  const published = drops.filter(d => d.published);
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <header className="relative isolate overflow-hidden border-b border-border grain">
        <div className="glow-mesh-soft animate-drift" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h1 className="font-display text-5xl sm:text-6xl">{t('dropsTitle')}</h1>
          <p className="mt-4 max-w-lg text-muted-foreground text-pretty">{t('dropsSubtitle')}</p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {published.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">{t('dropEmpty')}</p>
        ) : (
          <div className="space-y-20">
            {published.map((drop, index) => {
              const pieces = products.filter(p => p.dropId === drop.id);
              return (
                <article
                  key={drop.id}
                  className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
                >
                  {/* Alternate the image side so the page has a rhythm */}
                  <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                    <p className="eyebrow">{t('dropReleased', { date: dateFmt.format(new Date(drop.releasedAt)) })}</p>
                    <h2 className="mt-3 font-display text-4xl text-balance sm:text-5xl">
                      {drop.name}
                    </h2>
                    <p className="mt-4 font-display text-xl italic text-charcoal/55">
                      <MirrorText>{drop.statement}</MirrorText>
                    </p>
                    <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground text-pretty">
                      {drop.description}
                    </p>
                    <Link
                      to="/drops/$slug"
                      params={{ slug: drop.slug }}
                      className="group mt-7 inline-flex cursor-pointer items-center gap-2 rounded-full bg-charcoal px-7 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted"
                    >
                      {t('shopThisDrop')}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 flip-rtl" />
                    </Link>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t('dropPieces', { n: pieces.length })}
                    </p>
                  </div>

                  {/* Three pieces from the drop, fanned out */}
                  <Link
                    to="/drops/$slug"
                    params={{ slug: drop.slug }}
                    className={`grid grid-cols-3 gap-3 ${index % 2 === 1 ? 'lg:order-1' : ''}`}
                  >
                    {pieces.slice(0, 3).map((p, i) => (
                      <img
                        key={p.id}
                        src={productImage(p, 0)}
                        alt={p.name}
                        width={400}
                        height={480}
                        loading="lazy"
                        decoding="async"
                        className={`w-full rounded-2xl object-cover shadow-soft transition-transform duration-500 hover:-translate-y-1 ${
                          i === 1 ? 'mt-6' : ''
                        }`}
                      />
                    ))}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
