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
 */
export function Logo({
  src,
  className,
  label,
  priority = false,
}: {
  src: string;
  className?: string;
  label: string;
  priority?: boolean;
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
      sizes="(max-width: 640px) 120px, 160px"
      className={cn('h-10 w-auto select-none sm:h-11', className)}
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
