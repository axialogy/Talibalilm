import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { CourseSettingsForm } from '@/components/admin/CourseSettingsForm';
import { CoverUpload } from '@/components/admin/CoverUpload';
import { CourseOutline } from '@/components/admin/CourseOutline';
import { PublishControls } from '@/components/admin/PublishControls';
import { Tabs } from '@/components/ui/tabs';
import { CourseFees, type CourseFee } from '@/components/admin/CourseFees';
import { CourseCursus, membershipKey } from '@/components/admin/CourseCursus';
import { LiveSessionForm } from '@/components/admin/LiveSessionForm';
import { LiveSessionControls } from '@/components/admin/LiveSessionControls';
import { Badge } from '@/components/ui/badge';
import { listLiveSessions } from '@/lib/data/live';
import { createClient } from '@/lib/supabase/server';
import type { LiveStatus } from '@/lib/supabase/database.types';

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
       schedule, duration_weeks, status, published_at, cover_url,
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

  // Everything else this course needs, in parallel: what it costs, which
  // programmes carry it, and its live classes.
  const [{ data: feeRows }, { data: cursusRows }, { data: linkRows }, liveSessions] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, delivery, price_cents, duration_days, status, time_slot, schedule_label, hours_per_year, hours_per_week')
        .eq('kind', 'module')
        .eq('course_id', id)
        .order('delivery'),
      supabase.from('cursus').select('id, title, year_count').order('display_order'),
      supabase.from('cursus_courses').select('cursus_id, year_index, delivery').eq('course_id', id),
      listLiveSessions(id),
    ]);

  const fees: CourseFee[] = (feeRows ?? []).map((f) => ({
    id: f.id,
    delivery: f.delivery,
    priceCents: f.price_cents,
    durationDays: f.duration_days,
    status: f.status,
    timeSlot: f.time_slot,
    scheduleLabel: f.schedule_label,
    hoursPerYear: f.hours_per_year,
    hoursPerWeek: f.hours_per_week,
  }));

  const included = new Set(
    (linkRows ?? []).map((l) => membershipKey(l.cursus_id, l.year_index, l.delivery)),
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

      <div className="mt-6">
        <Tabs
          tabs={[
            {
              key: 'content',
              label: t('tabContent'),
              content: (
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <CourseOutline courseId={course.id} modules={modules} />
                  <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                    <CoverUpload courseId={course.id} coverUrl={course.cover_url} />
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
              ),
            },
            {
              key: 'fees',
              label: t('tabFees'),
              content: (
                <div className="max-w-3xl">
                  <p className="mb-4 text-[13px] leading-relaxed text-ink-muted">{t('tabFeesLead')}</p>
                  <CourseFees courseId={course.id} fees={fees} />
                </div>
              ),
            },
            {
              key: 'cursus',
              label: t('tabCursus'),
              content: (
                <div className="max-w-3xl">
                  <p className="mb-4 text-[13px] leading-relaxed text-ink-muted">
                    {t('tabCursusLead')}
                  </p>
                  <CourseCursus
                    courseId={course.id}
                    cursus={(cursusRows ?? []).map((c) => ({
                      id: c.id,
                      title: c.title,
                      yearCount: c.year_count,
                    }))}
                    included={included}
                  />
                </div>
              ),
            },
            {
              key: 'live',
              label: t('tabLive'),
              content: (
                <div className="max-w-3xl space-y-6">
                  <p className="text-[13px] leading-relaxed text-ink-muted">{t('tabLiveLead')}</p>
                  <LiveSessionForm courses={[]} fixedCourseId={course.id} />

                  {liveSessions.length === 0 ? (
                    <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-6 text-center text-sm text-ink-muted">
                      {t('liveNone')}
                    </p>
                  ) : (
                    <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
                      {liveSessions.map((s) => {
                        const label: Record<LiveStatus, string> = {
                          scheduled: t('liveStatusScheduled'),
                          live: t('liveStatusLive'),
                          ended: t('liveStatusEnded'),
                          cancelled: t('liveStatusCancelled'),
                        };
                        const tone: Record<LiveStatus, 'success' | 'soft' | 'muted' | 'danger'> = {
                          scheduled: 'soft',
                          live: 'success',
                          ended: 'muted',
                          cancelled: 'danger',
                        };
                        return (
                          <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-ink">{s.title}</p>
                                <Badge variant={tone[s.status]}>{label[s.status]}</Badge>
                              </div>
                              <p className="mt-0.5 text-[11px] text-ink-muted">
                                {s.scheduledAt
                                  ? new Intl.DateTimeFormat(locale, {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    }).format(new Date(s.scheduledAt))
                                  : t('liveNotScheduled')}
                              </p>
                            </div>
                            <LiveSessionControls
                              id={s.id}
                              roomToken={s.roomToken}
                              status={s.status}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
