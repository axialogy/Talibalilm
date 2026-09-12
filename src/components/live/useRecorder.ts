'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Record the class to the teacher's own machine.
 *
 * The room is a cross-origin iframe, so `MediaRecorder` cannot reach inside it.
 * Screen capture is the way in — and it turns out to be the better recording
 * anyway: it keeps the class exactly as the teacher saw it, video grid, shared
 * slides, screen share and all, rather than a handful of raw camera streams
 * that then need compositing.
 *
 * Two audio sources are mixed, because either alone is half a lesson: the
 * display capture carries the students (whatever the tab is playing) but never
 * the teacher, since a browser does not play your own microphone back to you.
 * So the mic is captured separately and merged through a WebAudio graph.
 *
 * On stop the file is handed straight to the browser's downloader. Nothing is
 * uploaded: the school puts it on YouTube or Drive themselves and pastes the
 * link onto the lesson, which is the workflow they already had.
 */
export type RecorderState = 'idle' | 'recording' | 'saving';

interface Recorder {
  state: RecorderState;
  error: string | null;
  seconds: number;
  start: () => Promise<void>;
  stop: () => void;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  // Ordered best-first; Safari only recently grew webm, so mp4 is a real case.
  for (const type of [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function useRecorder(fileBaseName: string): Recorder {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopAllRef = useRef<(() => void) | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    stopAllRef.current?.();
    stopAllRef.current = null;
    recorderRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setError('unsupported');
      return;
    }

    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
    } catch {
      // Almost always the teacher dismissing the picker; not worth an alarm.
      setError('cancelled');
      return;
    }

    // The microphone is a separate ask, and a refusal is survivable: a silent
    // teacher is worse than no recording, but a recording with only the
    // students audible is still worth having.
    let mic: MediaStream | null = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      mic = null;
    }

    const audioTracks = [...display.getAudioTracks(), ...(mic?.getAudioTracks() ?? [])];
    let context: AudioContext | null = null;
    let mixedTrack: MediaStreamTrack | null = null;

    if (audioTracks.length > 1) {
      // Two sources: merge them so the file has one coherent audio track.
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      context = new Ctor();
      const destination = context.createMediaStreamDestination();
      for (const track of audioTracks) {
        context.createMediaStreamSource(new MediaStream([track])).connect(destination);
      }
      mixedTrack = destination.stream.getAudioTracks()[0] ?? null;
    }

    const composed = new MediaStream([
      ...display.getVideoTracks(),
      ...(mixedTrack ? [mixedTrack] : audioTracks),
    ]);

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(composed, mimeType ? { mimeType } : undefined);
    } catch {
      setError('unsupported');
      display.getTracks().forEach((t) => t.stop());
      mic?.getTracks().forEach((t) => t.stop());
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      setState('saving');
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      const extension = (recorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileBaseName}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoked on a timer rather than immediately: Safari has been known to
      // abandon the download if the URL dies the same tick as the click.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);

      chunksRef.current = [];
      context?.close().catch(() => {});
      setState('idle');
      setSeconds(0);
    };

    stopAllRef.current = () => {
      display.getTracks().forEach((t) => t.stop());
      mic?.getTracks().forEach((t) => t.stop());
    };

    // The teacher can also stop the capture from the browser's own bar; that
    // must end the recording, not leave it running against a dead track.
    display.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      cleanup();
    });

    recorderRef.current = recorder;
    // A timeslice means chunks arrive as it goes, so a crash costs seconds
    // rather than the whole lesson.
    recorder.start(5_000);
    setState('recording');
    setSeconds(0);
    tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, [cleanup, fileBaseName]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    cleanup();
  }, [cleanup]);

  return { state, error, seconds, start, stop };
}
