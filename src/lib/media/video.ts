/**
 * Deciding whether an upload is really the video it claims to be.
 *
 * Same rule as `sniffImage`, for the same reason: the browser's content-type is
 * a hint and is trivially forged. A presigned PUT lets the browser write
 * anything at all to the key we signed, so the only moment the truth is
 * knowable is after the bytes exist and we read them back.
 *
 * Only the two containers a browser can actually play are accepted. A .mov or
 * .avi that a `<video>` element will refuse is worse than a refusal here: the
 * teacher would see a successful upload and the student a black rectangle.
 *
 * Pure and exported so the rule is tested without a bucket.
 */

/** 2 GB. A single presigned PUT can carry more; a teacher's patience cannot. */
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export type VideoKind = 'mp4' | 'webm';

const EXTENSION: Record<VideoKind, string> = { mp4: 'mp4', webm: 'webm' };
const CONTENT_TYPE: Record<VideoKind, string> = { mp4: 'video/mp4', webm: 'video/webm' };

/**
 * The container inferred from the leading bytes, or null if it is not one we
 * can play.
 *
 * MP4 (and MOV, and the whole ISO base media family) carries a box header in
 * the first eight bytes: four bytes of size, then the literal `ftyp`. The size
 * prefix is why this looks at offset 4 rather than offset 0.
 *
 * WebM and MKV are both Matroska, which starts with the EBML magic number
 * 1A 45 DF A3.
 */
export function sniffVideo(bytes: Uint8Array): VideoKind | null {
  if (
    bytes.length >= 8 &&
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70 // p
  ) {
    return 'mp4';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return 'webm';
  }
  return null;
}

export type VideoCheck =
  | { ok: true; kind: VideoKind; extension: string; contentType: string }
  | { ok: false; error: 'videoTooLarge' | 'notAVideo' };

/** Validate an uploaded object by its measured size and its actual bytes. */
export function checkVideo(head: Uint8Array, size: number): VideoCheck {
  // Size first: an object over the cap is refused whatever it contains, and
  // the figure passed in is the one MEASURED from the bucket, never the one the
  // browser announced before uploading.
  if (size > MAX_VIDEO_BYTES) return { ok: false, error: 'videoTooLarge' };
  if (size <= 0) return { ok: false, error: 'notAVideo' };

  const kind = sniffVideo(head);
  if (!kind) return { ok: false, error: 'notAVideo' };
  return { ok: true, kind, extension: EXTENSION[kind], contentType: CONTENT_TYPE[kind] };
}

/** A size a person can read. Used on the admin overview and beside each lesson. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Mo';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} Mo`;
  return `${(mb / 1024).toFixed(mb / 1024 < 10 ? 2 : 1)} Go`;
}
