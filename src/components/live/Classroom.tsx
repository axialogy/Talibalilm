'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Circle, Download, Square } from 'lucide-react';
import { useRecorder } from './useRecorder';
import { leaveRoom } from '@/app/actions/live';

/**
 * The classroom.
 *
 * Jitsi in an iframe rather than browser-to-browser connections, because the
 * school needs 10–50 people in a room. In a mesh the teacher's browser encodes
 * and uploads a separate copy of the video for every student; Jitsi runs an SFU
 * so the teacher uploads once and the server fans it out. Same experience, and
 * it survives a full class.
 *
 * Whether this component renders at all was decided in the database: the page
 * only reaches it after an RLS-gated read returned the session, so an
 * unentitled student never gets the room name in the first place.
 */
interface JitsiApi {
  dispose: () => void;
  addListener: (event: string, handler: () => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi;
  }
}

export function Classroom({
  domain,
  roomName,
  displayName,
  email,
  subject,
  isHost,
  sessionId,
  recordingBaseName,
}: {
  domain: string;
  roomName: string;
  displayName: string;
  email: string | null;
  subject: string;
  isHost: boolean;
  sessionId: string;
  recordingBaseName: string;
}) {
  const t = useTranslations('live');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const [failed, setFailed] = useState(false);
  const recorder = useRecorder(recordingBaseName);

  useEffect(() => {
    let cancelled = false;

    function mount() {
      if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;
      const api = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        parentNode: containerRef.current,
        userInfo: { displayName, email: email ?? undefined },
        configOverwrite: {
          subject,
          startWithAudioMuted: !isHost,
          startWithVideoMuted: !isHost,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false,
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
        },
      });
      apiRef.current = api;
      api.addListener('readyToClose', () => {
        void leaveRoom(sessionId);
        window.location.assign('/dashboard');
      });
    }

    if (window.JitsiMeetExternalAPI) {
      mount();
    } else {
      const script = document.createElement('script');
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = mount;
      script.onerror = () => setFailed(true);
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [domain, roomName, displayName, email, subject, isHost, sessionId]);

  const mmss = `${String(Math.floor(recorder.seconds / 60)).padStart(2, '0')}:${String(
    recorder.seconds % 60,
  ).padStart(2, '0')}`;

  return (
    <div className="flex h-dvh flex-col bg-ink">
      {isHost && (
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2.5">
          {recorder.state === 'recording' ? (
            <button
              type="button"
              onClick={recorder.stop}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-red-700"
            >
              <Square className="size-3.5 fill-current" aria-hidden="true" />
              {t('stopRecording')} · {mmss}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void recorder.start()}
              disabled={recorder.state === 'saving'}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-60"
            >
              <Circle className="size-3.5 fill-red-500 text-red-500" aria-hidden="true" />
              {recorder.state === 'saving' ? t('saving') : t('startRecording')}
            </button>
          )}

          <p className="flex items-center gap-1.5 text-[12px] text-white/60">
            <Download className="size-3.5" aria-hidden="true" />
            {t('recordingHint')}
          </p>

          {recorder.error && (
            <p role="alert" className="text-[12px] text-red-300">
              {t(recorder.error === 'unsupported' ? 'recordingUnsupported' : 'recordingCancelled')}
            </p>
          )}
        </div>
      )}

      {failed ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <p className="max-w-sm text-sm text-white/70">{t('roomUnavailable')}</p>
        </div>
      ) : (
        <div ref={containerRef} className="min-h-0 flex-1" />
      )}
    </div>
  );
}
