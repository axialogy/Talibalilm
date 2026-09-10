import { cn } from '@/lib/utils';

/**
 * The supplied brand artwork, in two colourways.
 *
 * `dark` is the black lockup, for the near-white storefront. `light` is the
 * white one, for the charcoal admin sidebar — a black mark on charcoal is
 * nearly invisible, so this is a real variant rather than a CSS filter.
 *
 * The wordmark already contains the monogram, so pages that show it do not
 * need a separate mark beside it.
 */
type LogoVariant = 'dark' | 'light';

const WORDMARK: Record<LogoVariant, string> = {
  dark: '/branding/wordmark-dark.webp',
  light: '/branding/wordmark-light.webp',
};

/** Intrinsic size of the supplied artwork, used to reserve layout space. */
const WORDMARK_RATIO = { width: 781, height: 182 };

/**
 * The circular monogram on its own — for square slots where the full lockup
 * would be unreadable: the login screen, favicons, app icons.
 */
export function LogoMark({ className, alt = '' }: { className?: string; alt?: string }) {
  return (
    <img
      src="/branding/icon.webp"
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={260}
      height={261}
      decoding="async"
      className={cn('h-8 w-8 select-none', className)}
    />
  );
}

/**
 * The full lockup. `brandName` is not rendered — the wordmark is artwork — but
 * it is used as the accessible name, so renaming the shop in settings still
 * changes what a screen reader announces.
 */
export function Logo({
  className,
  variant = 'dark',
  brandName = 'Grow & Glow',
  priority = false,
}: {
  className?: string;
  variant?: LogoVariant;
  brandName?: string;
  /** The header logo is above the fold; everything else can lazy-load. */
  priority?: boolean;
}) {
  return (
    <img
      src={WORDMARK[variant]}
      alt={brandName}
      width={WORDMARK_RATIO.width}
      height={WORDMARK_RATIO.height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={cn('h-7 w-auto select-none sm:h-8', className)}
    />
  );
}
