import Image from 'next/image';

/** Lines the office wrote as headings, told apart by their leading emoji. */
const HEADING_STARTS = ['📚', '✨', '➡️', '💳', '🎓', '📖', '⚠️', '🔸', '🔹'];

/**
 * What a cursus covers: the office's poster and/or its written outline.
 *
 * One component for the two places a student meets it — the module page, under
 * the module's own programme, and the cursus page — so the poster cannot be
 * shown at one size in one place and another in the other. The heading and the
 * cursus title stay with the caller: those differ by page.
 *
 * Renders nothing at all when the office has written neither, which is the
 * honest answer for a cursus whose programme is not published yet.
 */
export function CursusProgramme({
  alt,
  imageUrl,
  details,
}: {
  /** The cursus title, for the poster's alt text. */
  alt: string;
  imageUrl: string | null;
  details: string;
}) {
  const lines = details
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (!imageUrl && lines.length === 0) return null;

  return (
    <>
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={alt}
          width={1080}
          height={1350}
          sizes="(min-width: 768px) 768px, 100vw"
          className="mt-6 h-auto w-full rounded-[var(--radius-card)] border border-line"
        />
      )}

      {lines.length > 0 && (
        <div className="mt-6 space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
          {lines.map((line, index) => (
            <p
              key={`${index}-${line}`}
              className={
                HEADING_STARTS.some((start) => line.startsWith(start))
                  ? 'font-medium text-ink'
                  : undefined
              }
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
