import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Classroom } from '@/components/live/Classroom';
import { getLiveSessionByToken } from '@/lib/data/live';
import { joinRoom } from '@/app/actions/live';
import { jitsiDomain, jitsiRoomName } from '@/lib/live/config';
import { currentViewer } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The live classroom.
 *
 * Three things must be true to see a room, and the page checks none of them by
 * argument: `getLiveSessionByToken` is an RLS-gated read, so a student without
 * the entitlement gets nothing back and falls through to notFound(). Holding
 * the link is not holding a key — the policy re-checks the course every time.
 *
 * `can_join_live` is then asked separately because a row can be visible while
 * the door is shut: a class that has ended, or one that was cancelled.
 */
export default async function LiveRoomPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  if (!supabaseConfigured) redirect('/login');

  const viewer = await currentViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/live/${token}`)}`);

  const session = await getLiveSessionByToken(token);
  if (!session) notFound();

  const supabase = await createClient();
  const { data: mayJoin } = await supabase.rpc('can_join_live', { session_id: session.id });
  if (mayJoin !== true) {
    const t = await getTranslations('live');
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-xl font-semibold text-ink">{t('closedTitle')}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t('closedBody')}</p>
        </div>
      </main>
    );
  }

  // Attendance. Best-effort on purpose: a failure to log must never be the
  // reason a paying student cannot attend their class.
  await joinRoom(session.id).catch(() => {});

  const isHost = viewer.role === 'admin' || viewer.role === 'instructor';
  const stamp = new Date().toISOString().slice(0, 10);
  const safeTitle = session.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60);

  return (
    <Classroom
      domain={jitsiDomain()}
      roomName={jitsiRoomName(session.roomToken)}
      displayName={viewer.fullName || viewer.email || ''}
      email={viewer.email}
      subject={session.title}
      isHost={isHost}
      sessionId={session.id}
      recordingBaseName={`${safeTitle || 'cours'}-${stamp}`}
    />
  );
}
