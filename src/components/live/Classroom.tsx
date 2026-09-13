'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, MessageSquare, PresentationIcon, SquarePen, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoom } from './useRoom';
import { Stage } from './Stage';
import { Controls } from './Controls';
import { ChatPanel } from './ChatPanel';
import { ParticipantsPanel, type HostAction } from './ParticipantsPanel';
import { Whiteboard } from './Whiteboard';
import { SlidesPanel } from './SlidesPanel';
import { useRecorder } from './useRecorder';
import {
  clearBoard as clearBoardAction,
  controlParticipant,
  endLiveSessionById,
  saveBoardOp,
  saveMessage,
} from '@/app/actions/live';
import type { BoardOp, RoomMessage } from '@/lib/live/protocol';
import type { LiveRoomState } from '@/lib/supabase/database.types';

type Tab = 'chat' | 'people' | 'board' | 'slides';

/**
 * The classroom.
 *
 * The room this replaced was an embedded third-party page, and the teacher
 * joined their own class as a student because that server would not mint a
 * token telling it otherwise. Here the role arrives as a prop, decided by the
 * database before this component exists, and the host controls are simply not
 * part of a student's page — not hidden, not disabled, absent.
 *
 * The same fact is enforced twice more, because a hidden button is a courtesy
 * rather than a rule: a student's LiveKit token carries no camera source until
 * the teacher allows one, and every browser drops a host-only message that did
 * not come from the teacher's signed identity.
 */
export function Classroom({
  roomToken,
  sessionId,
  title,
  room: initial,
  slides,
  boardHistory,
  chatHistory,
  recordingBaseName,
}: {
  roomToken: string;
  sessionId: string;
  title: string;
  /** What the server says this viewer may do. The UI never infers it. */
  room: LiveRoomState;
  slides: { id: string; url: string | null; filename: string }[];
  boardHistory: BoardOp[];
  chatHistory: { id: string; name: string; isHost: boolean; body: string; at: number }[];
  recordingBaseName: string;
}) {
  const t = useTranslations('live');
  const isHost = initial.is_host;

  const [tab, setTab] = useState<Tab>(isHost ? 'people' : 'chat');
  const [panelOpen, setPanelOpen] = useState(false);
  const [slide, setSlide] = useState(-1);
  const [board, setBoard] = useState<{ ops: BoardOp[]; clearedAt: number }>({
    ops: [],
    clearedAt: 0,
  });

  const recorder = useRecorder(recordingBaseName);

  const onMessage = useCallback((message: RoomMessage) => {
    // Only messages that survived `acceptFrom` reach here, so anything below
    // genuinely came from the teacher.
    if (message.t === 'slide') setSlide(message.i);
    else if (message.t === 'board') setBoard((b) => ({ ...b, ops: [...b.ops, message.op] }));
    else if (message.t === 'board-clear') setBoard({ ops: [], clearedAt: Date.now() });
    else if (message.t === 'ended') window.location.assign('/dashboard');
  }, []);

  const live = useRoom({ roomToken, isHost, onMessage });

  // History arrives from the database, already filtered by the same policies
  // that guard the room, so a late joiner sees the lesson so far.
  useEffect(() => {
    live.setChat(
      chatHistory.map((line) => ({
        id: line.id,
        identity: '',
        name: line.name,
        isHost: line.isHost,
        body: line.body,
        at: line.at,
      })),
    );
    // Once, on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presenting = useMemo(
    () =>
      live.people.find((p) => p.sharing && !p.isLocal)?.identity ??
      (live.sharing ? (live.people.find((p) => p.isLocal)?.identity ?? null) : null),
    [live.people, live.sharing],
  );

  const currentSlideUrl = slide >= 0 ? (slides[slide]?.url ?? null) : null;

  const goToSlide = (index: number) => {
    setSlide(index);
    live.send({ t: 'slide', i: index });
  };

  const drawOp = (op: BoardOp) => {
    setBoard((b) => ({ ...b, ops: [...b.ops, op] }));
    live.send({ t: 'board', op });
    // Persisted, so somebody joining late still sees it. The write is refused
    // by policy for anyone but staff, so nothing here needs to check.
    void saveBoardOp(sessionId, op);
  };

  const clearBoard = () => {
    setBoard({ ops: [], clearedAt: Date.now() });
    live.send({ t: 'board-clear' });
    void clearBoardAction(sessionId);
  };

  const sendChat = (body: string) => {
    live.sendChat(body);
    // Delivery and the record are separate jobs: the room has already shown the
    // line, and a failed insert must not take it back off the screen.
    void saveMessage(sessionId, body);
  };

  const hostAction = async (identity: string, action: HostAction) => {
    const form = new FormData();
    form.set('sessionId', sessionId);
    form.set('userId', identity);
    form.set('action', action);
    // Authorised inside the database, not here: `live_set_participant` refuses
    // anyone who is not staff, whatever this page believes about itself.
    await controlParticipant({ ok: true }, form);
  };

  const endClass = async () => {
    if (!window.confirm(t('endConfirm'))) return;
    live.send({ t: 'ended' });
    await endLiveSessionById(sessionId);
    window.location.assign('/admin/live');
  };

  const tabs: { key: Tab; label: string; Icon: typeof Users }[] = [
    { key: 'chat', label: t('tabChat'), Icon: MessageSquare },
    { key: 'people', label: t('tabPeople'), Icon: Users },
    { key: 'board', label: t('tabBoard'), Icon: SquarePen },
    { key: 'slides', label: t('tabSlides'), Icon: PresentationIcon },
  ];

  if (live.status === 'failed' || (live.status === 'closed' && live.error)) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-xl font-semibold text-white">
            {live.error === 'removed' ? t('removedTitle') : t('closedTitle')}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/60">
            {live.error === 'removed' ? t('removedBody') : t('closedBody')}
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-ink text-white">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <h1 className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold">{title}</h1>

        {live.status === 'reconnecting' && (
          <span className="flex items-center gap-1.5 text-[12px] text-gold-300" role="status">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {t('reconnecting')}
          </span>
        )}
        {recorder.state === 'recording' && (
          <span className="flex items-center gap-1.5 text-[12px] text-red-300" role="status">
            <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
            {t('recording')}
          </span>
        )}

        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 lg:hidden"
          aria-expanded={panelOpen}
        >
          {panelOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Users className="size-5" aria-hidden="true" />
          )}
          <span className="sr-only">{t('tabPeople')}</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {live.status === 'connecting' ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-white/40" aria-hidden="true" />
            </div>
          ) : (
            <Stage
              room={live.room}
              people={live.people}
              presenting={presenting}
              slide={currentSlideUrl}
            />
          )}

          <Controls
            isHost={isHost}
            micOn={live.micOn}
            camOn={live.camOn}
            sharing={live.sharing}
            handUp={live.handUp}
            canMic={isHost || !initial.muted}
            canCam={isHost || initial.camera_allowed}
            canShare={isHost || initial.screen_allowed}
            recording={recorder.state}
            onMic={() => void live.toggleMic()}
            onCam={() => void live.toggleCam()}
            onShare={() => void live.toggleShare()}
            onHand={() => live.raiseHand(!live.handUp)}
            onAskCamera={() => live.send({ t: 'ask', what: 'camera' })}
            onAskScreen={() => live.send({ t: 'ask', what: 'screen' })}
            onRecord={() => {
              if (recorder.state === 'idle') {
                void recorder.start();
                live.send({ t: 'rec', on: true });
              } else {
                recorder.stop();
                live.send({ t: 'rec', on: false });
              }
            }}
            onPauseRecord={recorder.togglePause}
            onLeave={() => window.location.assign(isHost ? '/admin/live' : '/dashboard')}
            onEnd={() => void endClass()}
          />
        </div>

        <aside
          className={cn(
            'flex w-full max-w-sm shrink-0 flex-col border-s border-white/10 bg-black/25',
            panelOpen ? 'fixed inset-y-0 end-0 z-40 max-w-xs' : 'hidden',
            'lg:static lg:flex lg:w-80 lg:max-w-none',
          )}
        >
          <div className="flex border-b border-white/10" role="tablist">
            {tabs.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                title={label}
                onClick={() => setTab(key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-[12px] transition-colors',
                  tab === key
                    ? 'border-brand-400 text-white'
                    : 'border-transparent text-white/50 hover:text-white/80',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{label}</span>
              </button>
            ))}
          </div>

          {tab === 'chat' && (
            <ChatPanel
              lines={live.chat}
              canWrite={isHost || (initial.chat_enabled && !initial.muted)}
              closedReason={initial.muted ? 'muted' : 'closed'}
              onSend={sendChat}
            />
          )}
          {tab === 'people' && (
            <ParticipantsPanel
              people={live.people}
              isHost={isHost}
              onAction={(identity, action) => void hostAction(identity, action)}
              onClearAsk={live.clearAsk}
            />
          )}
          {tab === 'board' && (
            <Whiteboard
              canDraw={isHost}
              history={boardHistory}
              incoming={board}
              onOp={drawOp}
              onLiveOp={(op) => live.sendLossy({ t: 'board', op })}
              onClear={clearBoard}
            />
          )}
          {tab === 'slides' && (
            <SlidesPanel slides={slides} current={slide} canPresent={isHost} onGo={goToSlide} />
          )}
        </aside>
      </div>
    </div>
  );
}
