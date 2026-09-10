/**
 * YouTube link handling for unlock codes.
 *
 * A code printed inside a care label usually points at a video, so a pasted
 * YouTube URL is played inline rather than shown as a link the visitor has to
 * follow. Every URL shape YouTube hands out from a share sheet is accepted:
 *
 *   youtube.com/watch?v=ID   youtu.be/ID        youtube.com/shorts/ID
 *   youtube.com/embed/ID     youtube.com/live/ID
 */
export function youtubeId(rawUrl: string | undefined): string | null {
  if (!rawUrl?.trim()) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const isValid = (id: string) => /^[A-Za-z0-9_-]{11}$/.test(id);

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0];
    return isValid(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const v = parsed.searchParams.get('v');
    if (v && isValid(v)) return v;

    const [segment, id] = parsed.pathname.replace(/^\//, '').split('/');
    if (['embed', 'shorts', 'live', 'v'].includes(segment) && id && isValid(id)) return id;
  }

  return null;
}

/**
 * Privacy-preserving embed URL. youtube-nocookie.com does not set tracking
 * cookies until the visitor actually presses play.
 */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}
