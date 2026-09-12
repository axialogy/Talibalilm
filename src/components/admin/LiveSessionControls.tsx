'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cancelLiveSession, endLiveSession, startLiveSession } from '@/app/actions/live';
import type { AdminState } from '@/app/actions/admin';
import type { LiveStatus } from '@/lib/supabase/database.types';

const EMPTY: AdminState = { ok: true };

/**
 * Open, enter and close a room.
 *
 * Opening and entering are separate on purpose: the host may want the room
 * showing as live (so students can gather) a moment before they walk in.
 */
export function LiveSessionControls({
  id,
  roomToken,
  status,
}: {
  id: string;
  roomToken: string;
  status: LiveStatus;
}) {
  const t = useTranslations('admin');
  const [, start] = useActionState(startLiveSession, EMPTY);
  const [, end] = useActionState(endLiveSession, EMPTY);
  const [, cancel] = useActionState(cancelLiveSession, EMPTY);

  const finished = status === 'ended' || status === 'cancelled';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!finished && status !== 'live' && (
        <form action={start}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" size="sm">
            {t('liveStart')}
          </Button>
        </form>
      )}

      {status === 'live' && (
        <Link
          href={`/live/${roomToken}`}
          className="inline-flex items-center rounded-[var(--radius-input)] bg-brand-500 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand-600"
        >
          {t('liveJoin')}
        </Link>
      )}

      {status === 'live' && (
        <form action={end}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" size="sm" variant="ghost">
            {t('liveEnd')}
          </Button>
        </form>
      )}

      {!finished && status !== 'live' && (
        <form action={cancel}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
            {t('liveCancel')}
          </Button>
        </form>
      )}
    </div>
  );
}
