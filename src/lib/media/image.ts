/**
 * Deciding whether an upload is really the image it claims to be.
 *
 * The browser's declared content-type is a hint, not a fact — it is trivially
 * forged, and a server that trusts it will happily store an HTML file named
 * `.png` and serve it back with an image content-type, which is a stored-XSS
 * vector. So the type is read from the bytes, and the declared one is ignored.
 *
 * Pure and exported so the rule is tested without a storage backend.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export type ImageKind = 'png' | 'jpeg' | 'webp';

const EXTENSION: Record<ImageKind, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };

/** The image type inferred from the leading bytes, or null if it is not one we accept. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  // WEBP: 'RIFF' .... 'WEBP'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

export type ImageCheck =
  | { ok: true; kind: ImageKind; extension: string; contentType: string }
  | { ok: false; error: 'tooLarge' | 'notAnImage' };

/** Validate a candidate upload by its size and its actual bytes. */
export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: 'tooLarge' };
  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, error: 'notAnImage' };
  return { ok: true, kind, extension: EXTENSION[kind], contentType: `image/${kind}` };
}
