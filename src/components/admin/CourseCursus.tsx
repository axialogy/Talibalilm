'use client';

import { useTranslations } from 'next-intl';
import { setProgrammeEntry } from '@/app/actions/catalog';

export interface CursusOption {
  id: string;
  title: string;
  yearCount: number;
}

/** Which cursus/year/mode combinations already include this course. */
export type Membership = Set<string>;

export function membershipKey(cursusId: string, year: number, delivery: string): string {
  return `${cursusId}|${year}|${delivery}`;
}

/**
 * Which programmes this course belongs to.
 *
 * It lives on the course page because "is this module part of the Approfondi?"
 * is a fact about the course, and the teacher was previously answering it from
 * a different screen with the course list in their head.
 *
 * Each checkbox posts on change — no Save button to forget. Removing a tick
 * takes the module away from everyone enrolled in that year immediately, since
 * `has_course_access` reads this table live rather than from a cached copy.
 */
export function CourseCursus({
  courseId,
  cursus,
  included,
}: {
  courseId: string;
  cursus: CursusOption[];
  included: Membership;
}) {
  const t = useTranslations('admin');

  if (cursus.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-5 text-center text-[13px] text-ink-muted">
        {t('cursusNoneYet')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {cursus.map((c) => (
        <div key={c.id} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
          <p className="text-[13px] font-medium text-ink">{c.title}</p>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {Array.from({ length: c.yearCount }, (_, i) => i + 1).map((year) =>
              (['online', 'presentiel'] as const).map((delivery) => {
                const on = included.has(membershipKey(c.id, year, delivery));
                return (
                  <form key={`${year}-${delivery}`} action={setProgrammeEntry}>
                    <input type="hidden" name="cursus_id" value={c.id} />
                    <input type="hidden" name="course_id" value={courseId} />
                    <input type="hidden" name="year_index" value={year} />
                    <input type="hidden" name="delivery" value={delivery} />
                    <input type="hidden" name="included" value={on ? 'no' : 'yes'} />
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(event) => event.currentTarget.form?.requestSubmit()}
                        className="size-4 rounded border-line text-brand-500"
                      />
                      {c.yearCount > 1 && `${t('grantYear')} ${year} · `}
                      {delivery === 'online' ? t('deliveryOnline') : t('deliveryPresentiel')}
                    </label>
                  </form>
                );
              }),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
