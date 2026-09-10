import { getTranslations } from 'next-intl/server';
import { Clock, PlayCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { CourseArt } from '@/components/marketing/CourseArt';
import { getInstructor } from '@/lib/content/courses';
import { lessonCount, type Course } from '@/lib/content/types';
import { cn } from '@/lib/utils';

/**
 * A catalogue card.
 *
 * The whole card is not one link: the title and the CTA are. A single wrapping
 * anchor would give a screen reader one target whose accessible name is the
 * title, the rating, the instructor and the price run together.
 */
export async function CourseCard({ course, className }: { course: Course; className?: string }) {
  const t = await getTranslations('courses');
  const instructor = getInstructor(course.instructor_id);
  const lessons = lessonCount(course);

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card',
        className,
      )}
    >
      <div className="relative aspect-4/3 overflow-hidden bg-surface">
        <div className="size-full transition-transform duration-500 group-hover:scale-[1.04]">
          <CourseArt
            titleAr={course.title_ar}
            title={course.title}
            kicker={t(`category.${course.category}`)}
            tone={course.tone}
          />
        </div>
        <Badge className="absolute start-3 top-3">{t(`level.${course.level}`)}</Badge>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[15px] leading-snug font-semibold text-ink">
          <Link
            href={`/courses/${course.slug}`}
            className="line-clamp-2 transition-colors hover:text-brand-600"
          >
            {course.title}
          </Link>
        </h3>

        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{course.subtitle}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <PlayCircle className="size-3.5 text-brand-500" aria-hidden="true" />
            {t('card.lessons', { count: lessons })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 text-brand-500" aria-hidden="true" />
            {t('card.duration', { count: course.duration_weeks })}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
          {instructor && (
            <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
              <span
                className="flex size-6 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white"
                aria-hidden="true"
              >
                {instructor.full_name.charAt(0)}
              </span>
              {t('card.by', { name: instructor.full_name })}
            </span>
          )}
          <Link
            href={`/courses/${course.slug}`}
            className="rounded-md border border-brand-500 px-3 py-1.5 text-[11px] font-semibold text-brand-600 transition-colors hover:bg-brand-500 hover:text-white"
          >
            {t('card.viewCourse')}
          </Link>
        </div>
      </div>
    </article>
  );
}
