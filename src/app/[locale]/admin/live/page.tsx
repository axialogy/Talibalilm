import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import { Badge } from '@/components/ui/badge';
import { LiveSessionForm } from '@/components/admin/LiveSessionForm';
import { LiveSessionControls } from '@/components/admin/LiveSessionControls';
import { listLiveSessions } from '@/lib/data/live';
import { requireStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import type { LiveStatus } from '@/lib/supabase/database.types';

/**
 * Live classes.
 *
 * The school runs its own classroom rather than paying per seat and stopping at
 * forty minutes. What it does not run is its own paywall: a class belongs to a
 * course, and `has_course_access()` decides who gets in — the same gate as the
 * lessons, so there is nothing here to keep in step by hand.
 */
export default async function AdminLivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireStaff();
  const t = await getTranslations('admin');

  const supabase = await createClient();
  const [sessions, { data: courses }] = await Promise.all([
    listLiveSessions(),
    supabase.from('courses').select('id, title').order('display_order'),
  ]);

  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

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
    <div className="max-w-4xl">
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('liveTitle')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t('liveLead')}</p>

      <section className="mt-8">
        <h2 className="font-display text-[15px] font-semibold text-ink">{t('liveNew')}</h2>
        <div className="mt-3">
          <LiveSessionForm courses={courses ?? []} />
        </div>
      </section>

      <section className="mt-10">
        {sessions.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-6 text-center text-sm text-ink-muted">
            {t('liveNone')}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{s.title}</p>
                    <Badge variant={tone[s.status]}>{label[s.status]}</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {s.courseTitle}
                    {' · '}
                    {s.scheduledAt ? when.format(new Date(s.scheduledAt)) : t('liveNotScheduled')}
                    {' · '}
                    {t('liveCapacityShort', { count: s.maxParticipants })}
                  </p>
                </div>
                <LiveSessionControls id={s.id} roomToken={s.roomToken} status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
