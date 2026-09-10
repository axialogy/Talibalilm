import { ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * The compact banner every inner page opens with. Reuses the home hero's wash
 * and its reach up behind the header, so the top of the screen keeps its shape
 * as you move between pages.
 */
export async function PageHero({
  eyebrow,
  title,
  lead,
  crumb,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  crumb?: string;
}) {
  const t = await getTranslations('nav');

  return (
    <section className="hero-wash relative isolate -mt-18 overflow-hidden rounded-br-[56px] pt-18 lg:rounded-br-[110px]">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG */}
      <img
        src="/media/hero-mosque.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-0 end-0 h-full w-[52%] object-cover object-center opacity-45 [mask-image:linear-gradient(to_right,transparent,black_26%)] select-none sm:opacity-70 lg:w-[40%]"
      />

      <div className="shell relative py-14 sm:py-16 lg:py-20">
        {crumb && (
          <nav aria-label="fil d'ariane" className="mb-5 flex items-center gap-1.5 text-xs">
            <Link href="/" className="text-ink-muted transition-colors hover:text-brand-600">
              {t('home')}
            </Link>
            <ChevronRight className="size-3 text-ink-muted/60 rtl:-scale-x-100" aria-hidden="true" />
            <span className="text-ink">{crumb}</span>
          </nav>
        )}

        {eyebrow && <p className="eyebrow">{eyebrow}</p>}

        <h1 className="mt-3 max-w-3xl font-display text-[clamp(1.75rem,4.5vw,2.75rem)] leading-[1.15] font-semibold tracking-[-0.03em] text-ink">
          {title}
        </h1>

        {lead && <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-muted">{lead}</p>}
      </div>
    </section>
  );
}
