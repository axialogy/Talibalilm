import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { ProductCard } from '@/components/shop/ProductCard';
import { MirrorText } from '@/components/MirrorText';

export const Route = createFileRoute('/drops/$slug')({
  component: DropPage,
});

function DropPage() {
  const { slug } = Route.useParams();
  const { t, locale } = useI18n();
  const { drops, products } = useGlowStore();

  const drop = drops.find(d => d.slug === slug);

  if (!drop) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <h1 className="font-display text-4xl">404</h1>
        <p className="mt-3 text-muted-foreground">{t('dropEmpty')}</p>
        <Link
          to="/drops"
          className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-full bg-charcoal px-6 py-3 text-sm text-white"
        >
          {t('dropsTitle')}
        </Link>
      </div>
    );
  }

  const pieces = products.filter(p => p.dropId === drop.id);
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <header className="relative isolate overflow-hidden border-b border-border grain">
        <div className="glow-mesh animate-drift" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <Link
            to="/drops"
            className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5 flip-rtl" />
            {t('dropsTitle')}
          </Link>

          <p className="eyebrow mt-8">
            {t('dropReleased', { date: dateFmt.format(new Date(drop.releasedAt)) })}
          </p>
          <h1 className="mt-3 font-display text-5xl text-balance sm:text-6xl">{drop.name}</h1>

          <p className="mt-6 font-display text-2xl italic text-charcoal/60">
            <MirrorText>{drop.statement}</MirrorText>
          </p>

          <p className="mx-auto mt-6 max-w-xl leading-relaxed text-muted-foreground text-pretty">
            {drop.description}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="eyebrow mb-8">{t('dropPieces', { n: pieces.length })}</p>
        {pieces.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">{t('noProducts')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {pieces.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
