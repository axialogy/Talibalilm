import { getTranslations } from 'next-intl/server';
import { EventCard } from '@/components/marketing/EventCard';
import type { EventView } from '@/lib/data/site';
import { safeLocale } from '@/i18n/routing';

/**
 * Actualités & événements.
 *
 * Returns null when the school has published nothing. That is deliberate: a
 * heading over an empty grid advertises that the institute has no news, which
 * is worse than the section simply not being there yet.
 *
 * The card itself is a client component because its cover opens full-size in a
 * modal; the dates are formatted here, on the server, so the browser is not
 * asked to know the visitor's locale.
 */
export async function EventsSection({ events, locale }: { events: EventView[]; locale: string }) {
  if (events.length === 0) return null;

  const t = await getTranslations('home');
  const dateFmt = new Intl.DateTimeFormat(safeLocale(locale), { dateStyle: 'long', timeStyle: 'short' });

  return (
    <section className="pattern-islamic py-16 sm:py-20">
      <div className="shell">
        <h2 className="text-center font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
          {t('events.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] leading-relaxed text-ink-muted">
          {t('events.lead')}
        </p>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              title={event.title}
              titleAr={event.titleAr}
              excerpt={event.excerpt}
              imageUrl={event.imageUrl}
              dateLabel={event.startsAt ? dateFmt.format(new Date(event.startsAt)) : null}
              location={event.location}
              href={event.href}
              labels={{
                cta: t('events.cta'),
                imageLabel: t('events.imageLabel'),
                imageClose: t('events.imageClose'),
              }}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
