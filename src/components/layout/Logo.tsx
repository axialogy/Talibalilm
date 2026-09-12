import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * The institute's lockup.
 *
 * `next/image` rather than a plain `<img>`, and that is not decoration: the
 * supplied artwork is a 3682px PNG weighing 257 KB, rendered at about 66px
 * wide. Served raw it costs every visitor a quarter of a megabyte on every
 * page for a logo the size of a thumbnail. Through the optimiser it comes back
 * as a few kilobytes of WebP at the size actually needed.
 *
 * The `src` is resolved on the server by `@/lib/artwork`, so the markup never
 * points at a file that is not there — and the school can drop a new file in
 * without touching this component.
 *
 * `sizes` is a prop because the lockup is rendered anywhere from 40px tall in
 * the header to 96px in the footer. Baking one value in meant the optimiser
 * served the header's width everywhere, and the footer upscaled it — a visibly
 * soft logo in the one place it is shown large.
 */
export function Logo({
  src,
  className,
  label,
  priority = false,
  sizes = '(max-width: 640px) 160px, 220px',
}: {
  src: string;
  className?: string;
  label: string;
  priority?: boolean;
  /** Match the rendered width, or the optimiser serves the wrong resolution. */
  sizes?: string;
}) {
  return (
    <Image
      src={src}
      alt={label}
      width={660}
      height={434}
      priority={priority}
      // The height is fixed in CSS and the width flows from the artwork's own
      // aspect, so the declared pair above only reserves space before load.
      sizes={sizes}
      className={cn('h-12 w-auto select-none sm:h-14', className)}
    />
  );
}

export function LogoMark({
  src,
  className,
  alt = '',
}: {
  src: string;
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={512}
      height={512}
      sizes="72px"
      className={cn('size-9 select-none rounded-[22%]', className)}
    />
  );
}
