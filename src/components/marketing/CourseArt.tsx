import type { ArtTone } from '@/lib/content/types';
import { cn } from '@/lib/utils';

/**
 * Generated cover artwork.
 *
 * `Course.cover_url` wins when the school uploads one. Until then this draws a
 * cover rather than showing a grey box: a catalogue of grey rectangles reads
 * as an unfinished site, a set of coloured titled covers reads as a catalogue.
 * Inline SVG so the self-hosted fonts apply and the Arabic shapes correctly —
 * an external .svg loaded through <img> gets neither.
 */
const TONES: Record<ArtTone, { from: string; to: string; ink: string; wash: string }> = {
  emerald: { from: '#118866', to: '#0f5241', ink: '#ffffff', wash: '#7fd2ba' },
  indigo: { from: '#2b3f8f', to: '#16225a', ink: '#ffffff', wash: '#9fb2ff' },
  plum: { from: '#5b2b6b', to: '#331642', ink: '#ffffff', wash: '#dcaef0' },
  sand: { from: '#d1b275', to: '#a8843e', ink: '#241a06', wash: '#fbf7ef' },
  crimson: { from: '#8f2230', to: '#4d101a', ink: '#ffffff', wash: '#ffb3ba' },
  teal: { from: '#166f7a', to: '#0a3b45', ink: '#ffffff', wash: '#9fe8f2' },
  night: { from: '#2b3b38', to: '#0e1614', ink: '#ffffff', wash: '#a8c9bd' },
};

/** Greedy wrap into at most `max` lines; the last takes an ellipsis. */
function wrap(text: string, perLine: number, max: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= perLine) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
      if (lines.length === max) break;
    }
  }
  if (lines.length < max && current) lines.push(current);
  const last = lines[max - 1];
  if (lines.length === max && last && lines.join(' ').length < text.length - 1) {
    lines[max - 1] = `${last.slice(0, perLine - 1)}…`;
  }
  return lines;
}

export function CourseArt({
  titleAr,
  title,
  kicker,
  tone,
  className,
}: {
  titleAr: string;
  title: string;
  kicker?: string;
  tone: ArtTone;
  className?: string;
}) {
  const t = TONES[tone];

  // Sized to the space it has rather than to a bracket, because a long
  // discipline name otherwise runs straight through the gold frame.
  //
  // The frame leaves 312 units of the 400-wide viewBox, and 300 keeps a
  // margin. Alexandria's Arabic measures between 0.47 and 0.56 em per
  // character across the catalogue — connected script varies a lot with which
  // letters join — so the divisor is the WIDEST of those, not the average: a
  // short name coming out slightly small is invisible, a long one overflowing
  // is not. Re-measure this if the face ever changes again; the previous 0.46
  // was tuned for Tajawal and overflowed five of six covers under Alexandria.
  const arSize = Math.max(18, Math.min(60, Math.round(300 / Math.max(1, titleAr.length * 0.56))));
  const titleLines = wrap(title, 30, 2);

  return (
    <svg
      viewBox="0 0 400 300"
      className={cn('size-full', className)}
      role="img"
      aria-label={title}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`ca-${tone}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
      </defs>

      <rect width="400" height="300" fill={`url(#ca-${tone})`} />

      <g fill="none" stroke={t.wash} strokeWidth="1.2" opacity="0.26">
        <circle cx="336" cy="52" r="58" />
        <circle cx="336" cy="52" r="40" />
        <circle cx="64" cy="256" r="70" />
        <circle cx="64" cy="256" r="50" />
      </g>

      {/* Gold hairline, the way a bound volume is tooled */}
      <rect x="16" y="16" width="368" height="268" fill="none" stroke="#c4a05a" strokeWidth="1.5" opacity="0.75" />

      {kicker && (
        <text
          x="200"
          y="86"
          textAnchor="middle"
          fill={t.ink}
          opacity="0.72"
          fontFamily="Alexandria, system-ui, sans-serif"
          fontSize="13"
          fontWeight="500"
          letterSpacing="3"
        >
          {kicker.toUpperCase()}
        </text>
      )}

      <text
        x="200"
        y="168"
        textAnchor="middle"
        fill={t.ink}
        fontFamily="Alexandria, system-ui, sans-serif"
        fontSize={arSize}
        fontWeight="700"
        direction="rtl"
      >
        {titleAr}
      </text>

      <line x1="150" y1="198" x2="250" y2="198" stroke="#c4a05a" strokeWidth="2" />

      <text
        x="200"
        y="236"
        textAnchor="middle"
        fill={t.ink}
        opacity="0.9"
        fontFamily="Alexandria, system-ui, sans-serif"
        fontSize="15"
        fontWeight="500"
      >
        {titleLines.map((line, i) => (
          <tspan key={line} x="200" dy={i === 0 ? 0 : 20}>
            {line}
          </tspan>
        ))}
      </text>
    </svg>
  );
}
