import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/admin/BackLink';
import { Badge } from '@/components/ui/badge';
import { LiveSessionControls } from '@/components/admin/LiveSessionControls';
import { SlideDeck } from '@/components/admin/SlideDeck';
import { Tabs } from '@/components/ui/tabs';
import { getLiveSession, listSlides, listJoinRequests } from '@/lib/data/live';
import { r2Configured } from '@/lib/storage/r2';
import { requireStaff } from '@/lib/auth/guards';
import type { LiveStatus } from '@/lib/supabase/database.types';

/**
 * One live class: its deck, its door, and the controls to run it.
 *
 * The deck lives here rather than in the room because a teacher builds it
 * before the class and the room is a full-screen surface with no space for
 * file management. During the class the slides are presented by sharing the
 * screen, which Jitsi already does well — so this page is preparation, and the
 * room is delivery.
 */
export default async function AdminLiveSessionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requireStaff();
  const t = await getTranslations('admin');

  const session = await getLiveSession(id);
  if (!session) notFound();

  const [slides, waiting] = await Promise.all([listSlides(id), listJoinRequests(id)]);

  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' });
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
      <BackLink href="/admin/live" label={t('liveTitle')} />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">{session.title}</h1>
        <Badge variant={tone[session.status]}>{label[session.status]}</Badge>
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        {session.courseTitle}
        {' · '}
        {session.scheduledAt ? when.format(new Date(session.scheduledAt)) : t('liveNotScheduled')}
        {' · '}
        {t('liveCapacityShort', { count: session.maxParticipants })}
      </p>

      <div className="mt-5">
        <LiveSessionControls
          id={session.id}
          roomToken={session.roomToken}
          status={session.status}
        />
      </div>

      <div className="mt-8">
        <Tabs
          tabs={[
            {
              key: 'slides',
              label: t('slidesTab'),
              content: (
                <>
                  <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
                    {t('slidesLead')}
                  </p>
                  <SlideDeck sessionId={session.id} slides={slides} storageReady={r2Configured} />
                </>
              ),
            },
            {
              key: 'door',
              label: t('liveDoorTab', { count: waiting.length }),
              content:
                waiting.length === 0 ? (
                  <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-6 text-center text-[13px] text-ink-muted">
                    {t('liveDoorEmpty')}
                  </p>
                ) : (
                  <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
                    {waiting.map((request) => (
                      <li key={request.id} className="flex flex-wrap items-center gap-3 p-4">
                        <p className="min-w-0 flex-1 text-[13px] text-ink">
                          {request.displayName || t('liveGuest')}
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          {new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
                            new Date(request.requestedAt),
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
