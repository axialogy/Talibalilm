import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Check } from 'lucide-react';
import { BackLink } from '@/components/admin/BackLink';
import { setProgrammeEntry } from '@/app/actions/catalog';
import { CursusForm } from '@/components/admin/CursusForm';
import { CursusTariff, type CursusPrice } from '@/components/admin/CursusTariff';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/server';
import type { DeliveryMode } from '@/lib/supabase/database.types';

const MODES: DeliveryMode[] = ['presentiel', 'online'];

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
export default async function AdminCursusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const supabase = await createClient();

  const [{ data: cursus }, { data: courses }, { data: programme }, { data: priceRows }] =
    await Promise.all([
      supabase
        .from('cursus')
        .select('id, slug, kind, title, subtitle, description, year_count, status, display_order')
        .order('display_order'),
      supabase
        .from('courses')
        .select('id, title')
        .order('display_order'),
      supabase.from('cursus_courses').select('cursus_id, course_id, delivery, year_index'),
      supabase
        .from('products')
        .select('id, cursus_id, delivery, year_index, price_cents, duration_days, status')
        .eq('kind', 'cursus'),
    ]);

  const included = new Set(
    (programme ?? []).map((r) => `${r.cursus_id}|${r.course_id}|${r.delivery}|${r.year_index}`),
  );

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
              <div className="mt-3 space-y-6">
                {MODES.map((delivery) => (
                  <div key={delivery}>
                    <h4 className="text-[13px] font-medium text-ink">
                      {delivery === 'presentiel' ? t('deliveryPresentiel') : t('deliveryOnline')}
                    </h4>

                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[520px] border-collapse text-[13px]">
                        <caption className="sr-only">
                          {option.title} — {t('programme')}
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col" className="p-2 text-start font-medium text-ink-muted">
                              {t('course')}
                            </th>
                            {Array.from({ length: option.year_count }, (_, i) => i + 1).map(
                              (year) => (
                                <th
                                  key={year}
                                  scope="col"
                                  className="p-2 text-center font-medium text-ink-muted"
                                >
                                  {t('yearIndex')} {year}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {(courses ?? []).map((course) => (
                            <tr key={course.id} className="border-t border-line">
                              <th scope="row" className="p-2 text-start font-normal text-ink">
                                {course.title}
                              </th>
                              {Array.from({ length: option.year_count }, (_, i) => i + 1).map(
                                (year) => {
                                  const on = included.has(
                                    `${option.id}|${course.id}|${delivery}|${year}`,
                                  );
                                  return (
                                    <td key={year} className="p-2 text-center">
                                      <form action={setProgrammeEntry}>
                                        <input type="hidden" name="cursus_id" value={option.id} />
                                        <input type="hidden" name="course_id" value={course.id} />
                                        <input type="hidden" name="delivery" value={delivery} />
                                        <input type="hidden" name="year_index" value={year} />
                                        <input
                                          type="hidden"
                                          name="included"
                                          value={on ? 'no' : 'yes'}
                                        />
                                        <button
                                          type="submit"
                                          aria-pressed={on}
                                          aria-label={`${course.title} — ${t('yearIndex')} ${year}`}
                                          className={`inline-flex size-7 items-center justify-center rounded-md transition-colors ${
                                            on
                                              ? 'bg-brand-500 text-white'
                                              : 'bg-surface text-ink-muted/40 hover:bg-brand-50'
                                          }`}
                                        >
                                          <Check className="size-3.5" aria-hidden="true" />
                                        </button>
                                      </form>
                                    </td>
                                  );
                                },
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="font-display text-[15px] font-semibold text-ink">{t('cursusDetails')}</h3>
            <div className="mt-3">
              <CursusForm cursus={option} />
            </div>
          </section>
        </div>
      ),
    })),
    {
      key: '__new',
      label: `+ ${t('newCursus')}`,
      content: (
        <div className="max-w-2xl">
          <CursusForm />
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
