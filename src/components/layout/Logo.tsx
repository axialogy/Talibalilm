import { cn } from '@/lib/utils';

/**
 * Presentational only — the `src` is resolved on the server by
 * `@/lib/artwork`, so this works from a Server or a Client Component and the
 * markup never points at a file that is not there.
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      width={660}
      height={434}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={512}
      height={512}
      decoding="async"
      className={cn('size-9 select-none rounded-[22%]', className)}
    />
  );
}
