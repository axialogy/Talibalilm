'use client';

import { useTranslations } from 'next-intl';
import { setCursusYear } from '@/app/actions/catalog';
import { membershipKey, type Membership } from '@/lib/content/cursus';

export interface CursusOption {
  id: string;
  kind: string;
  title: string;
  yearCount: number;
}

/** The years shown for Approfondi. The school runs five at most. */
const MAX_YEARS = 5;

/**
 * How this module is sold: à la carte, inside the Approfondi, or both.
 *
 * Two boxes, matching the two routes the checkout actually offers, rather than
 * a list of every cursus row. The previous version drew a grid of year × mode
 * checkboxes — "Année 1 · en ligne" beside "Année 1 · présentiel" — and the
 * teacher ticked both every time, because the school does not teach a module in
 * one mode and not the other. The student chooses how to attend; the module is
 * simply taught. So the unit here is the YEAR and both rows move together.
 *
 * Each checkbox posts on change — no Save button to forget. Unticking a year
 * takes the module away from everyone enrolled in it immediately, because
 * `has_course_access` reads this table live rather than a cached copy.
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

  const perModule = cursus.find((c) => c.kind === 'module');
  const approfondi = cursus.find((c) => c.kind === 'approfondi');

  // Nothing to tick until the two cursus exist. Said plainly with the way out,
  // rather than an empty box that looks broken.
  if (!perModule && !approfondi) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-5 text-center text-[13px] text-ink-muted">
        {t('cursusNoneYet')}
      </p>
    );
  }

  const on = (cursusId: string, year: number) =>
    included.has(membershipKey(cursusId, year, 'presentiel')) ||
    included.has(membershipKey(cursusId, year, 'online'));

  return (
    <div className="space-y-4">
      {perModule && (
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
          <Toggle
            courseId={courseId}
            cursusId={perModule.id}
            year={1}
            checked={on(perModule.id, 1)}
            label={t('cursusPerModule')}
            strong
          />
          <p className="mt-1.5 ps-6 text-[11px] leading-relaxed text-ink-muted">
            {t('cursusPerModuleHint')}
          </p>
        </div>
      )}

      {approfondi && (
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
          <p className="text-[13px] font-medium text-ink">{t('cursusApprofondi')}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
            {t('cursusApprofondiHint')}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {Array.from(
              { length: Math.min(approfondi.yearCount || MAX_YEARS, MAX_YEARS) },
              (_, i) => i + 1,
            ).map((year) => (
              <Toggle
                key={year}
                courseId={courseId}
                cursusId={approfondi.id}
                year={year}
                checked={on(approfondi.id, year)}
                label={`${t('grantYear')} ${year}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One checkbox that posts itself.
 *
 * A form per checkbox rather than one form with many: each is an independent
 * decision, and a shared form would make a failure on one look like a failure
 * on all of them.
 */
function Toggle({
  courseId,
  cursusId,
  year,
  checked,
  label,
  strong = false,
}: {
  courseId: string;
  cursusId: string;
  year: number;
  checked: boolean;
  label: string;
  strong?: boolean;
}) {
  return (
    <form action={setCursusYear}>
      <input type="hidden" name="cursus_id" value={cursusId} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="year_index" value={year} />
      <input type="hidden" name="included" value={checked ? 'no' : 'yes'} />
      <label
        className={`flex cursor-pointer items-center gap-2 text-ink ${
          strong ? 'text-[13px] font-medium' : 'text-[12px]'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="size-4 rounded border-line text-brand-500"
        />
        {label}
      </label>
    </form>
  );
}
