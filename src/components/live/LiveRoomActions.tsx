'use client';

import { useMemo, type ReactNode } from 'react';
import {
  controlParticipant,
  endLiveSessionById,
  saveBoardOp,
  clearBoard,
  saveMessage,
} from '@/app/actions/live';
import type { BoardOp } from '@/lib/live/protocol';
import type { HostAction } from './ParticipantsPanel';

/**
 * The server actions the classroom calls, bound to one session.
 *
 * A thin seam, and a deliberate one: the room is a large Client Component and
 * server actions cannot be passed through a Server Component's props without
 * something doing this binding. Keeping it here means the room itself never
 * builds a FormData or knows a session id belongs in one — it calls a function.
 *
 * Every one of these is authorised on the server. Nothing here decides whether
 * the caller is the teacher; `live_set_participant` refuses a student inside
 * the database, and the board and chat writes are refused by policy.
 */
export function LiveRoomActions({
  sessionId,
  children,
}: {
  sessionId: string;
  children: (actions: {
    onHostAction: (userId: string, action: HostAction) => Promise<void>;
    onBoardOp: (op: BoardOp) => Promise<void>;
    onBoardClear: () => Promise<void>;
    onChatSave: (body: string) => Promise<void>;
    onEnd: () => Promise<void>;
  }) => ReactNode;
}) {
  const actions = useMemo(
    () => ({
      onHostAction: async (userId: string, action: HostAction) => {
        const form = new FormData();
        form.set('sessionId', sessionId);
        form.set('userId', userId);
        form.set('action', action);
        await controlParticipant({ ok: true }, form);
      },
      onBoardOp: async (op: BoardOp) => {
        await saveBoardOp(sessionId, op);
      },
      onBoardClear: async () => {
        await clearBoard(sessionId);
      },
      onChatSave: async (body: string) => {
        await saveMessage(sessionId, body);
      },
      onEnd: async () => {
        await endLiveSessionById(sessionId);
      },
    }),
    [sessionId],
  );

  return <>{children(actions)}</>;
}
