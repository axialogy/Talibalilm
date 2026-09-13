'use client';

import { Track, type Participant, type Room } from 'livekit-client';
import { cn } from '@/lib/utils';
import { VideoTile } from './VideoTile';
import type { RoomPerson } from './useRoom';

/**
 * What the class is looking at.
 *
 * A lesson is not a meeting of equals, so the layout is not an even grid. When
 * something is being presented — a shared screen, or the slide deck — it takes
 * the stage and everyone else becomes a strip. Otherwise the teacher is large
 * and the students are small, which is what a class looks like.
 *
 * Only participants whose video is actually flowing get a tile of their own in
 * the strip; forty cameras-off tiles would be forty empty boxes pushing the
 * lesson off the screen, so they are counted in the participants panel instead.
 */
export function Stage({
  room,
  people,
  presenting,
  slide,
}: {
  room: Room;
  people: RoomPerson[];
  /** Identity of whoever is sharing a screen, if anyone. */
  presenting: string | null;
  /** The current slide's image, when the teacher is presenting the deck. */
  slide: string | null;
}) {
  const byIdentity = (identity: string): Participant | undefined =>
    identity === room.localParticipant.identity
      ? room.localParticipant
      : room.remoteParticipants.get(identity);

  const host = people.find((p) => p.isHost);
  const sharer = presenting ? people.find((p) => p.identity === presenting) : undefined;
  const focusIsShare = Boolean(sharer);

  // The strip: everyone except whoever holds the stage, with cameras on first.
  const strip = people
    .filter((p) => p.identity !== sharer?.identity)
    .filter((p) => (focusIsShare || slide ? true : p.identity !== host?.identity))
    .filter((p) => p.camOn || p.isLocal || p.handUp || p.speaking)
    .slice(0, 12);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black/30">
        {slide && !focusIsShare ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide} alt="" className="size-full object-contain" />
        ) : sharer ? (
          (() => {
            const p = byIdentity(sharer.identity);
            return p ? (
              <VideoTile
                participant={p}
                person={sharer}
                source={Track.Source.ScreenShare}
                className="size-full rounded-2xl ring-0"
              />
            ) : null;
          })()
        ) : host ? (
          (() => {
            const p = byIdentity(host.identity);
            return p ? (
              <VideoTile participant={p} person={host} className="size-full rounded-2xl ring-0" />
            ) : null;
          })()
        ) : (
          <div className="flex size-full items-center justify-center px-6 text-center">
            <p className="max-w-xs text-sm text-white/50">…</p>
          </div>
        )}
      </div>

      {strip.length > 0 && (
        <ul
          className={cn(
            'grid shrink-0 gap-2',
            'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6',
            '[&>li]:aspect-video',
          )}
        >
          {strip.map((person) => {
            const p = byIdentity(person.identity);
            if (!p) return null;
            return (
              <li key={person.identity}>
                <VideoTile participant={p} person={person} className="size-full" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
