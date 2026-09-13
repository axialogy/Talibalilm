/**
 * Shrink a picked photo before it is uploaded.
 *
 * This exists because of two limits that disagreed, and the smaller one was
 * invisible: the server accepts 5 MB (`MAX_IMAGE_BYTES`), but a Server Action
 * body is capped at 1 MB by default, so every photo from a phone died before
 * it ever reached the validator — with no message that named a size.
 *
 * Re-encoding in the browser fixes more than the size:
 *
 *   * A cover is displayed a few hundred pixels wide. Sending twelve megapixels
 *     to store it is waste at every step — upload, storage, and every page view
 *     afterwards.
 *   * An iPhone hands over HEIC, which the byte sniffer rightly refuses because
 *     it is not one of the three types we serve. Drawing it to a canvas and
 *     re-encoding produces a JPEG, so the photo works instead of being called
 *     "not an image" for a reason nobody can act on.
 *
 * It never throws. If anything about the canvas path fails — an unsupported
 * source format, a tainted canvas, a browser without `toBlob` — the original
 * file is returned and the server decides. Degrading to "the old behaviour" is
 * always better than refusing an upload the user could otherwise have made.
 */

/** How wide a cover is ever displayed, doubled for high-density screens. */
export const COVER_MAX_WIDTH = 1600;

/**
 * The box an image fits into, preserving its aspect ratio.
 *
 * Separated from the canvas work because this is the part with an off-by-one
 * in it: an image already smaller than the box must be left ALONE rather than
 * scaled up, which is the bug that turns a small sharp logo into a blurry one.
 */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Re-encode a picked file as a JPEG no larger than `max` on its longest side.
 *
 * Returns the ORIGINAL file untouched if the browser cannot do it, so the
 * caller never has to handle a failure case.
 */
export async function downscaleImage(file: File, max = COVER_MAX_WIDTH): Promise<File> {
  if (typeof document === 'undefined') return file;

  let url: string | null = null;
  try {
    url = URL.createObjectURL(file);
    const image = await loadImage(url);

    const size = fitWithin(image.naturalWidth, image.naturalHeight, max);
    if (size.width === 0) return file;

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image, 0, 0, size.width, size.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    if (!blob) return file;

    // Only keep the re-encode when it actually helped. A small, already
    // optimised PNG can come back LARGER as a JPEG, and shipping the worse of
    // the two would be a silent downgrade — except for a source the server
    // cannot read at all (HEIC), where any JPEG is an improvement.
    const readable = /^image\/(png|jpeg|webp)$/.test(file.type);
    if (readable && blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') || 'cover';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('the browser could not decode this image'));
    image.src = src;
  });
}
