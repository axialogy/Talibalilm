import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import { CourseRowActions } from '@/components/admin/CourseRowActions';
import { BookOpen } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { NewCourseForm } from '@/components/admin/NewCourseForm';
import { createClient } from '@/lib/supabase/server';

/** Staff see drafts here; the `courses_select_staff` policy is what allows it. */
export default async function AdminCoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, status, display_order, modules(id, lessons(id))')
    .order('display_order', { ascending: true });

  const rows = courses ?? [];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <BackLink href="/admin" label={t('navOverview')} />
        <h1 className="font-display text-2xl font-semibold text-ink">{t('courses')}</h1>

        {rows.length === 0 ? (
          <p className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-10 text-center text-sm text-ink-muted">
            {t('empty')}
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
            {rows.map((course) => {
              const moduleCount = course.modules?.length ?? 0;
              const lessonCount =
                course.modules?.reduce((n, m) => n + (m.lessons?.length ?? 0), 0) ?? 0;

              return (
                // The whole row opens the course: the title link stretches over
                // it with a pseudo-element, so there is still exactly one link
                // to tab to and the buttons on the right stay clickable above it.
                <li
                  key={course.id}
                  className="relative flex flex-wrap items-center gap-4 p-4 transition-colors hover:bg-brand-50/40 focus-within:bg-brand-50/40 focus-within:ring-2 focus-within:ring-brand-300 focus-within:ring-inset"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
                    aria-hidden="true"
                  >
                    <BookOpen className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="font-display text-[15px] font-semibold text-ink transition-colors after:absolute after:inset-0 hover:text-brand-600 focus-visible:outline-none"
                    >
                      {course.title}
                    </Link>
                    <p className="text-[11px] text-ink-muted">
                      {moduleCount} {t('modules')} · {lessonCount} {t('lessons')}
                    </p>
                  </div>
                  <Badge variant={course.status === 'published' ? 'brand' : 'muted'}>
                    {t(course.status)}
                  </Badge>
                  <div className="relative">
                    <CourseRowActions courseId={course.id} status={course.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <aside>
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
          <h2 className="font-display text-[15px] font-semibold text-ink">{t('newCourse')}</h2>
          <NewCourseForm />
        </div>
      </aside>
    </div>
  );
}
