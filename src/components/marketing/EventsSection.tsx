import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { safeLocale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import type { EventView } from '@/lib/data/site';

/**
 * Actualités & événements.
 *
 * Returns null when the school has published nothing. That is deliberate: a
 * heading over an empty grid advertises that the institute has no news, which
 * is worse than the section simply not being there yet.
 *
 * An event without an image gets a plain coloured panel rather than a broken
 * frame or a stock photograph — the office should not have to find a picture
 * before it can announce a date.
 */
export async function EventsSection({ events, locale }: { events: EventView[]; locale: string }) {
  if (events.length === 0) return null;

  const t = await getTranslations('home');
  const dateFmt = new Intl.DateTimeFormat(safeLocale(locale), {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <section className="py-16 sm:py-20">
      <div className="shell">
        <h2 className="text-center font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-gold-600">
          {t('events.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] leading-relaxed text-ink-muted">
          {t('events.lead')}
        </p>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white"
            >
              <div className="relative aspect-[3/2] bg-brand-900">
                {event.imageUrl ? (
                  <Image
                    src={event.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <span
                    className="flex size-full items-center justify-center text-gold-400"
                    aria-hidden="true"
                  >
                    <CalendarDays className="size-10" />
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                {event.startsAt && (
                  <p className="flex items-center gap-1.5 text-[11px] tracking-[0.08em] text-gold-600 uppercase">
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    {dateFmt.format(new Date(event.startsAt))}
                  </p>
                )}

                <h3 className="mt-2 font-display text-[16px] font-semibold text-ink">
                  {event.title}
                </h3>
                {event.titleAr && (
                  <p lang="ar" dir="rtl" className="mt-1 font-arabic text-lg text-gold-600">
                    {event.titleAr}
                  </p>
                )}

                {event.excerpt && (
                  <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-muted">
                    {event.excerpt}
                  </p>
                )}

                {event.location && (
                  <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-muted">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    {event.location}
                  </p>
                )}

                {/*
                  The link the office typed may be one of our pages or an
                  outside form. An absolute URL leaves through a plain anchor;
                  next-intl's Link would prefix it with a locale and produce a
                  path that does not exist.
                */}
                {event.href && (
                  <div className="mt-5">
                    {/^https?:\/\//i.test(event.href) ? (
                      <Button asChild size="sm" variant="gold">
                        <a href={event.href} target="_blank" rel="noopener noreferrer">
                          {t('events.cta')}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </a>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="gold">
                        <Link href={event.href}>
                          {t('events.cta')}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
