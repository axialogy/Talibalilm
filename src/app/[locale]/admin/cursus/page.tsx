import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import { Check } from 'lucide-react';
import { setProgrammeEntry } from '@/app/actions/catalog';
import { CursusForm } from '@/components/admin/CursusForm';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import type { DeliveryMode } from '@/lib/supabase/database.types';

const MODES: DeliveryMode[] = ['presentiel', 'online'];

/**
 * The programme grid — the school's own four-year table, made editable.
 *
 * Every tick here is read live by `has_course_access`, so removing a subject
 * from a year closes it for everyone enrolled in that year. That is the
 * intended behaviour, and it is why this screen is staff-only at three layers:
 * the route guard, the `is_staff()` policy, and the absence of any grant that
 * would let a student write to `cursus_courses`.
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

  const [{ data: cursus }, { data: courses }, { data: programme }] = await Promise.all([
    supabase
      .from('cursus')
      .select('id, slug, kind, title, subtitle, description, year_count, status, display_order')
      .order('display_order', { ascending: true }),
    supabase
      .from('courses')
      .select('id, title')
      .order('display_order', { ascending: true }),
    supabase.from('cursus_courses').select('cursus_id, course_id, delivery, year_index'),
  ]);

  const included = new Set(
    (programme ?? []).map((r) => `${r.cursus_id}|${r.course_id}|${r.delivery}|${r.year_index}`),
  );

  return (
    <div>
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('cursusList')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        {t('programmeLead')}
      </p>

      <div className="mt-8 space-y-10">
        {(cursus ?? []).map((option) => (
          <section key={option.id}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-lg font-semibold text-ink">{option.title}</h2>
              {option.status !== 'published' && (
                <Badge variant="soft">{t(option.status as 'draft')}</Badge>
              )}
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-[12px] text-ink-muted transition-colors hover:text-brand-600">
                {t('save')}
              </summary>
              <div className="mt-3">
                <CursusForm cursus={option} />
              </div>
            </details>

            {option.kind === 'approfondi' && (
              <div className="mt-5 space-y-6">
                {MODES.map((delivery) => (
                  <div key={delivery}>
                    <h3 className="text-[13px] font-medium text-ink">
                      {delivery === 'presentiel'
                        ? t('deliveryPresentiel')
                        : t('deliveryOnline')}
                    </h3>

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
                                        <input
                                          type="hidden"
                                          name="cursus_id"
                                          value={option.id}
                                        />
                                        <input
                                          type="hidden"
                                          name="course_id"
                                          value={course.id}
                                        />
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
            )}
          </section>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="font-display text-lg font-semibold text-ink">{t('newCursus')}</h2>
        <div className="mt-3">
          <CursusForm />
        </div>
      </section>
    </div>
  );
}
