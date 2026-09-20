import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import { CursusForm } from '@/components/admin/CursusForm';
import { CursusDeleteButton } from '@/components/admin/CursusDeleteButton';
import { CursusTariff, type CursusPrice } from '@/components/admin/CursusTariff';
import { CursusYearPicker } from '@/components/admin/CursusYearPicker';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/server';
import { requireLocale } from '@/i18n/routing';

/**
 * Programmes.
 *
 * One tab per cursus rather than all of them stacked: the page used to render
 * every programme's settings form and its whole course matrix one after
 * another, so finding the second one meant scrolling past the first entire
 * timetable.
 *
 * The fee lives here too, on one line beside the programme it prices. It was
 * previously on a general price list next to every module price — three screens
 * away from the thing it belonged to, and the same figures readable in two
 * places that could disagree.
 */
export default async function AdminCursusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  requireLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const supabase = await createClient();

  const [{ data: cursus }, { data: courses }, { data: programme }, { data: priceRows }] =
    await Promise.all([
      supabase
        .from('cursus')
        .select(
          'id, slug, kind, title, subtitle, description, details, image_url, year_count, status, display_order',
        )
        .order('display_order'),
      supabase.from('courses').select('id, title').order('display_order'),
      supabase.from('cursus_courses').select('cursus_id, course_id, delivery, year_index'),
      supabase
        .from('products')
        .select('id, cursus_id, delivery, year_index, price_cents, duration_days, status')
        .eq('kind', 'cursus'),
    ]);

  // Per cursus and per year, ignoring the mode: the two delivery rows are
  // written together, and access never reads the mode anyway.
  const includedByCursus = new Map<string, Map<number, string[]>>();
  for (const row of programme ?? []) {
    const byYear = includedByCursus.get(row.cursus_id) ?? new Map<number, string[]>();
    const list = byYear.get(row.year_index) ?? [];
    if (!list.includes(row.course_id)) list.push(row.course_id);
    byYear.set(row.year_index, list);
    includedByCursus.set(row.cursus_id, byYear);
  }

  const pricesFor = (cursusId: string): CursusPrice[] =>
    (priceRows ?? [])
      .filter((p) => p.cursus_id === cursusId)
      .map((p) => ({
        id: p.id,
        delivery: p.delivery,
        yearIndex: p.year_index,
        priceCents: p.price_cents,
        durationDays: p.duration_days,
        status: p.status,
      }));

  const list = cursus ?? [];

  const tabs = [
    ...list.map((option) => ({
      key: option.id,
      label: option.title,
      content: (
        <div className="space-y-10">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-semibold text-ink">{option.title}</h2>
            {option.status !== 'published' && (
              <Badge variant="soft">{t(option.status as 'draft')}</Badge>
            )}
          </div>

          <section>
            <h3 className="font-display text-[15px] font-semibold text-ink">{t('cursusTariff')}</h3>
            <p className="mt-1 mb-3 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
              {t('cursusTariffLead')}
            </p>
            <CursusTariff
              cursusId={option.id}
              yearCount={option.year_count}
              prices={pricesFor(option.id)}
            />
          </section>

          {option.kind === 'approfondi' && (
            <section>
              <h3 className="font-display text-[15px] font-semibold text-ink">{t('programme')}</h3>
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
                {t('programmeLead')}
              </p>

              <div className="mt-3 space-y-3">
                {Array.from({ length: option.year_count }, (_, i) => i + 1).map((year) => (
                  <CursusYearPicker
                    key={year}
                    cursusId={option.id}
                    year={year}
                    courses={courses ?? []}
                    selected={includedByCursus.get(option.id)?.get(year) ?? []}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="font-display text-[15px] font-semibold text-ink">
              {t('cursusDetails')}
            </h3>
            <div className="mt-3">
              <CursusForm cursus={option} courses={courses ?? []} />
            </div>
            <CursusDeleteButton cursusId={option.id} />
          </section>
        </div>
      ),
    })),
    {
      key: '__new',
      label: `+ ${t('newCursus')}`,
      content: (
        <div className="max-w-2xl">
          <CursusForm courses={courses ?? []} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('cursusList')}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        {t('programmeLead')}
      </p>

      <Tabs tabs={tabs} />
    </div>
  );
}
