'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type Participant,
  type RemoteParticipant,
} from 'livekit-client';
import {
  acceptFrom,
  decodeMessage,
  encodeMessage,
  participantIsHost,
  type RoomMessage,
} from '@/lib/live/protocol';

/**
 * The classroom connection.
 *
 * One hook owns the LiveKit room so the components below it stay presentational
 * and the connection is not rebuilt every time React re-renders a video tile.
 *
 * The token is fetched from our own endpoint, never held in the page, and the
 * endpoint re-asks the database on every renewal — so a student the teacher
 * removes mid-lesson is disconnected rather than lingering until their token
 * would have lapsed.
 */

export interface RoomPerson {
  identity: string;
  name: string;
  isHost: boolean;
  isLocal: boolean;
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  speaking: boolean;
  handUp: boolean;
  /** What they last asked the teacher for, if anything. */
  asking: 'camera' | 'screen' | null;
}

export interface ChatLine {
  id: string;
  identity: string;
  name: string;
  isHost: boolean;
  body: string;
  at: number;
}

export type RoomStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'closed';

interface Options {
  roomToken: string;
  /** Decided by the server and passed down; the UI never infers it. */
  isHost: boolean;
  onMessage?: (message: RoomMessage, fromHost: boolean) => void;
}

export function useRoom({ roomToken, isHost, onMessage }: Options) {
  const room = useMemo(() => new Room({ adaptiveStream: true, dynacast: true }), []);
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<RoomPerson[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [handUp, setHandUp] = useState(false);

  // Hands and pending requests live outside LiveKit's own state, so they are
  // kept here and merged into the participant list when it is rebuilt.
  const handsRef = useRef<Map<string, boolean>>(new Map());
  const asksRef = useRef<Map<string, 'camera' | 'screen'>>(new Map());
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const snapshot = useCallback(() => {
    const all: Participant[] = [
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values()),
    ];
    setPeople(
      all.map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
        isHost: participantIsHost(p.metadata),
        isLocal: p === room.localParticipant,
        micOn: p.isMicrophoneEnabled,
        camOn: p.isCameraEnabled,
        sharing: p.isScreenShareEnabled,
        speaking: p.isSpeaking,
        handUp: handsRef.current.get(p.identity) ?? false,
        asking: asksRef.current.get(p.identity) ?? null,
      })),
    );
  }, [room]);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const response = await fetch('/api/live/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomToken }),
        });
        if (!response.ok) {
          // 403 covers not entitled, removed, and class over — deliberately the
          // same answer, so the page says "the room is closed" rather than
          // telling a student which.
          setError(response.status === 403 ? 'closed' : 'unavailable');
          setStatus('failed');
          return;
        }
        const { token, url } = (await response.json()) as { token: string; url: string };
        if (cancelled) return;
        if (!url) {
          // The server has LiveKit credentials but no public URL to hand out,
          // which is a misconfiguration rather than a closed door.
          setError('unavailable');
          setStatus('failed');
          return;
        }
        await room.connect(url, token);
        if (cancelled) return;
        setStatus('connected');
        snapshot();
      } catch {
        if (!cancelled) {
          setError('unavailable');
          setStatus('failed');
        }
      }
    }

    const onData = (payload: Uint8Array, from?: RemoteParticipant) => {
      const message = decodeMessage(payload);
      if (!message) return;
      const fromHost = participantIsHost(from?.metadata);
      // The rule that makes a student unable to drive the lesson: host-only
      // messages are dropped on receipt, whoever claims to have sent them.
      if (!acceptFrom(message, fromHost)) return;

      const identity = from?.identity ?? room.localParticipant.identity;
      if (message.t === 'hand') {
        handsRef.current.set(identity, message.up);
        snapshot();
      } else if (message.t === 'ask') {
        asksRef.current.set(identity, message.what);
        snapshot();
      } else if (message.t === 'chat') {
        setChat((lines) => [
          ...lines.slice(-199),
          {
            id: `${identity}-${Date.now()}-${lines.length}`,
            identity,
            name: from?.name || from?.identity || '',
            isHost: fromHost,
            body: message.body,
            at: Date.now(),
          },
        ]);
      }
      onMessageRef.current?.(message, fromHost);
    };

    const onLocalTrack = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.Microphone) setMicOn(!pub.isMuted);
      if (pub.source === Track.Source.Camera) setCamOn(!pub.isMuted);
      if (pub.source === Track.Source.ScreenShare) setSharing(true);
      snapshot();
    };

    room
      .on(RoomEvent.ParticipantConnected, snapshot)
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        handsRef.current.delete(p.identity);
        asksRef.current.delete(p.identity);
        snapshot();
      })
      .on(RoomEvent.TrackSubscribed, snapshot)
      .on(RoomEvent.TrackUnsubscribed, snapshot)
      .on(RoomEvent.TrackMuted, snapshot)
      .on(RoomEvent.TrackUnmuted, snapshot)
      .on(RoomEvent.ActiveSpeakersChanged, snapshot)
      .on(RoomEvent.LocalTrackPublished, onLocalTrack)
      .on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) setSharing(false);
        if (pub.source === Track.Source.Camera) setCamOn(false);
        if (pub.source === Track.Source.Microphone) setMicOn(false);
        snapshot();
      })
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Reconnecting) setStatus('reconnecting');
        if (state === ConnectionState.Connected) setStatus('connected');
      })
      .on(RoomEvent.Disconnected, (reason) => {
        // Being removed by the teacher is a normal outcome, not a fault, and
        // the page should say so rather than offering to reconnect.
        setStatus('closed');
        if (reason === DisconnectReason.PARTICIPANT_REMOVED) setError('removed');
      })
      // The teacher's decision reaches the media server, so our own permission
      // can change mid-lesson. Reflect it rather than leaving a dead button.
      .on(RoomEvent.ParticipantPermissionsChanged, snapshot);

    void connect();

    return () => {
      cancelled = true;
      room.disconnect();
    };
  }, [room, roomToken, snapshot]);

  const send = useCallback(
    (message: RoomMessage) => {
      if (room.state !== ConnectionState.Connected) return;
      void room.localParticipant.publishData(encodeMessage(message), { reliable: true });
    },
    [room],
  );

  /** Lossy for the in-progress stroke: a dropped point is invisible, a queue is not. */
  const sendLossy = useCallback(
    (message: RoomMessage) => {
      if (room.state !== ConnectionState.Connected) return;
      void room.localParticipant.publishData(encodeMessage(message), { reliable: false });
    },
    [room],
  );

  const toggleMic = useCallback(async () => {
    const next = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [room]);

  const toggleCam = useCallback(async () => {
    const next = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  }, [room]);

  const toggleShare = useCallback(async () => {
    const next = !room.localParticipant.isScreenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(next, { audio: true });
    setSharing(next);
  }, [room]);

  const raiseHand = useCallback(
    (up: boolean) => {
      setHandUp(up);
      handsRef.current.set(room.localParticipant.identity, up);
      snapshot();
      send({ t: 'hand', up });
    },
    [room, send, snapshot],
  );

  const sendChat = useCallback(
    (body: string) => {
      const trimmed = body.trim().slice(0, 2000);
      if (!trimmed) return;
      send({ t: 'chat', body: trimmed });
      setChat((lines) => [
        ...lines.slice(-199),
        {
          id: `me-${Date.now()}`,
          identity: room.localParticipant.identity,
          name: room.localParticipant.name || '',
          isHost,
          body: trimmed,
          at: Date.now(),
        },
      ]);
    },
    [isHost, room, send],
  );

  const clearAsk = useCallback(
    (identity: string) => {
      asksRef.current.delete(identity);
      snapshot();
    },
    [snapshot],
  );

  return {
    room,
    status,
    error,
    people,
    chat,
    setChat,
    micOn,
    camOn,
    sharing,
    handUp,
    send,
    sendLossy,
    sendChat,
    toggleMic,
    toggleCam,
    toggleShare,
    raiseHand,
    clearAsk,
  };
}
