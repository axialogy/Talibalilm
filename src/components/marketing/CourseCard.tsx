import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
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
 * The whole card is not one link: the cover, the title and the two actions are.
 * A single wrapping anchor would give a screen reader one target whose
 * accessible name is the title, the instructor and the price run together.
 *
 * The cover is the school's own image when one is uploaded (`cover_url`, set
 * from the module's Contenu step and served from Supabase storage), and the
 * drawn artwork otherwise. The generated art used to be the only thing this
 * card ever showed — `CourseArt`'s comment claimed otherwise, and an uploaded
 * cover appeared on the module's own page and nowhere else.
 *
 * The cover is a link because people click pictures — but it carries
 * `aria-hidden` and `tabIndex={-1}`, so it is a fourth mouse target rather than
 * a fourth stop for anyone using a keyboard, who already has the title.
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
        <Link
          href={`/courses/${course.slug}`}
          aria-hidden="true"
          tabIndex={-1}
          className="block size-full"
        >
          <div className="size-full transition-transform duration-500 group-hover:scale-[1.04]">
            {course.cover_url ? (
              <Image
                src={course.cover_url}
                alt=""
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            ) : (
              <CourseArt titleAr={course.title_ar} title={course.title} tone={course.tone} />
            )}
          </div>
        </Link>
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

        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
          {course.subtitle}
        </p>

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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
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
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/courses/${course.slug}`}
              className="rounded-md border border-brand-500 px-3 py-1.5 text-[11px] font-semibold text-brand-600 transition-colors hover:bg-brand-500 hover:text-white"
            >
              {t('card.viewCourse')}
            </Link>
            {/*
              Straight to the enrolment card on the module page. The fragment
              does the scrolling — `scroll-behavior` is set in CSS, which means
              it is also where `prefers-reduced-motion` turns the animation off.
              A script would have had to re-implement that rule by hand.
            */}
            <Link
              href={`/courses/${course.slug}#inscription`}
              className="rounded-md bg-brand-500 px-5 py-2.5 text-[12px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-600"
            >
              {t('card.enrol')}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
