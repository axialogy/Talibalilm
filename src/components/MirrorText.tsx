import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The brand's signature: text rendered backwards, the way it is printed on
 * the garments. It only resolves when you hold it up to a mirror.
 *
 * Accessibility note — the flip is a CSS transform, so the text stays in the
 * DOM in its correct reading order. Screen readers, search engines and
 * copy-paste all get the real sentence; only the pixels are mirrored.
 */
export function MirrorText({
  children,
  className,
  reversed = true,
}: {
  children: React.ReactNode;
  className?: string;
  reversed?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
        className,
      )}
      style={{ transform: reversed ? 'scaleX(-1)' : 'scaleX(1)' }}
    >
      {children}
    </span>
  );
}

/**
 * A mirror the visitor can pick up: click (or focus + Enter) to flip the line
 * the right way round. `hint` is the affordance label shown underneath.
 */
export function MirrorToggle({
  text,
  className,
  textClassName,
  showLabel,
  hideLabel,
  startReversed = true,
}: {
  text: string;
  className?: string;
  textClassName?: string;
  showLabel: string;
  hideLabel: string;
  startReversed?: boolean;
}) {
  const [reversed, setReversed] = useState(startReversed);

  return (
    <div className={cn('flex flex-col items-center gap-5', className)}>
      <button
        type="button"
        onClick={() => setReversed(r => !r)}
        aria-pressed={!reversed}
        className="group relative cursor-pointer rounded-2xl px-4 py-2 text-center"
      >
        <MirrorText
          reversed={reversed}
          className={cn('font-display text-3xl italic sm:text-4xl md:text-5xl', textClassName)}
        >
          {text}
        </MirrorText>
      </button>

      <span className="text-[11px] font-medium uppercase tracking-widest2 text-muted-foreground">
        {reversed ? showLabel : hideLabel}
      </span>
    </div>
  );
}
