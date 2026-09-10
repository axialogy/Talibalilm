import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { CourseSettingsForm } from '@/components/admin/CourseSettingsForm';
import { CourseOutline } from '@/components/admin/CourseOutline';
import { PublishControls } from '@/components/admin/PublishControls';
import { createClient } from '@/lib/supabase/server';

/**
 * The course builder — the screen the school lives in.
 *
 * Staff read draft courses and lesson content through the `is_staff()`
 * policies, so this page needs no special client: the same anon key that
 * refuses a student answers fully for an instructor.
 */
export default async function CourseBuilderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const supabase = await createClient();

  const { data: course } = await supabase
    .from('courses')
    .select(
      `id, slug, title, subtitle, description, title_ar, category, level, format, tone,
       schedule, duration_weeks, status, published_at,
       modules ( id, title, position,
         lessons ( id, title, slug, type, position, duration_seconds, is_preview ) )`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!course) notFound();

  // Content is fetched separately rather than joined: it is the gated table,
  // and keeping the query distinct makes it obvious which read needs staff
  // rights and which does not.
  const lessonIds = (course.modules ?? []).flatMap((m) => (m.lessons ?? []).map((l) => l.id));
  const { data: contentRows } = lessonIds.length
    ? await supabase
        .from('lesson_content')
        .select('lesson_id, content, video_id')
        .in('lesson_id', lessonIds)
    : { data: [] };

  const contentByLesson = Object.fromEntries(
    (contentRows ?? []).map((row) => [row.lesson_id, { content: row.content, videoId: row.video_id }]),
  );

  const modules = (course.modules ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      id: m.id,
      title: m.title,
      position: m.position,
      lessons: (m.lessons ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          position: l.position,
          minutes: Math.round(l.duration_seconds / 60),
          isPreview: l.is_preview,
          content: contentByLesson[l.id]?.content ?? '',
          videoId: contentByLesson[l.id]?.videoId ?? '',
        })),
    }));

  return (
    <div>
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-2 text-xs text-ink-muted transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t('backToCourses')}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">{course.title}</h1>
        <PublishControls courseId={course.id} status={course.status} slug={course.slug} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <CourseOutline courseId={course.id} modules={modules} />
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CourseSettingsForm
            course={{
              id: course.id,
              title: course.title,
              slug: course.slug,
              subtitle: course.subtitle,
              description: course.description,
              title_ar: course.title_ar,
              category: course.category,
              level: course.level,
              format: course.format,
              tone: course.tone,
              schedule: course.schedule,
              duration_weeks: course.duration_weeks,
            }}
          />
        </aside>
      </div>
    </div>
  );
}
