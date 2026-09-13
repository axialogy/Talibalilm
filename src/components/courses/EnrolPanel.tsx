import { getTranslations } from 'next-intl/server';
import { Clock, GraduationCap, MapPin, PlayCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/commerce/quote';
import type { CoursePrice } from '@/lib/data/courses';

/**
 * The panel that stays beside the programme while somebody reads it.
 *
 * It answers the three questions a reader has, in the order they have them:
 * what does it cost, what am I committing to, and where do I sign. The prices
 * come from the products table, so what is promised here is what the checkout
 * will charge — a sales page that invents a figure eventually disagrees with
 * the till.
 *
 * A module with no published price is not on sale yet, and it says so rather
 * than showing a confident zero next to a button that would take money.
 */
export async function EnrolPanel({
  locale,
  prices,
  lessons,
  durationWeeks,
  format,
  level,
  schedule,
}: {
  locale: string;
  prices: CoursePrice[];
  lessons: number;
  durationWeeks: number;
  format: string;
  level: string;
  schedule: string;
}) {
  const t = await getTranslations('courses');

  const facts = [
    { key: 'lessons', Icon: PlayCircle, value: t('card.lessons', { count: lessons }) },
    { key: 'duration', Icon: Clock, value: t('card.duration', { count: durationWeeks }) },
    { key: 'format', Icon: MapPin, value: t(`format.${format}` as 'format.hybride') },
    { key: 'level', Icon: GraduationCap, value: t(`level.${level}` as 'level.all') },
  ];

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card">
      {prices.length > 0 ? (
        <>
          <ul className="space-y-3">
            {prices.map((price) => (
              <li
                key={price.delivery}
                className="flex items-baseline justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
              >
                <span className="text-[13px] text-ink-muted">
                  {price.delivery === 'online' ? t('detail.online') : t('detail.onSite')}
                </span>
                <span className="font-display text-xl font-semibold text-ink">
                  {formatPrice(price.priceCents, locale, price.currency)}
                </span>
              </li>
            ))}
          </ul>
          <Button asChild block size="lg" className="mt-5">
            <Link href="/checkout">{t('detail.enrollCta')}</Link>
          </Button>
        </>
      ) : (
        <p className="text-[13px] leading-relaxed text-ink-muted">{t('detail.notOnSale')}</p>
      )}

      <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
        {facts.map(({ key, Icon, value }) => (
          <li key={key} className="flex items-center gap-2.5 text-[13px] text-ink-muted">
            <Icon className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
            {value}
          </li>
        ))}
        {schedule && (
          <li className="flex items-center gap-2.5 text-[13px] text-ink-muted">
            <Clock className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
            {schedule}
          </li>
        )}
      </ul>
    </div>
  );
}
