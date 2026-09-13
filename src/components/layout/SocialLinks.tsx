import { Facebook, Instagram, MessageCircle, Youtube } from 'lucide-react';
import { socialLinks, type SocialKey, type SocialValues } from '@/lib/content/social';
import { cn } from '@/lib/utils';

/** TikTok has no Lucide icon, so the glyph is inline. */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.7a5.69 5.69 0 0 0-.77-.05 5.68 5.68 0 1 0 5.68 5.68V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.28 4.28 0 0 1-3.23-1.48z" />
    </svg>
  );
}

const ICONS: Record<SocialKey, (props: { className?: string }) => React.ReactNode> = {
  facebook: ({ className }) => <Facebook className={className} aria-hidden="true" />,
  instagram: ({ className }) => <Instagram className={className} aria-hidden="true" />,
  tiktok: TikTokIcon,
  youtube: ({ className }) => <Youtube className={className} aria-hidden="true" />,
  whatsapp: ({ className }) => <MessageCircle className={className} aria-hidden="true" />,
};

const LABELS: Record<SocialKey, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
};

/**
 * The school's social links, wherever they are shown.
 *
 * One component so the footer and the contact page cannot drift apart, and one
 * source — `site_settings` — so the office edits them once. A platform with no
 * value set draws no icon: `socialLinks` has already dropped it, because an
 * icon that goes nowhere is worse than no icon.
 */
export function SocialLinks({
  values,
  className,
  size = 'sm',
}: {
  values: SocialValues;
  className?: string;
  size?: 'sm' | 'lg';
}) {
  const links = socialLinks(values);
  if (links.length === 0) return null;

  const box = size === 'lg' ? 'size-11' : 'size-9';
  const glyph = size === 'lg' ? 'size-5' : 'size-4';

  return (
    <ul className={cn('flex flex-wrap items-center gap-2', className)}>
      {links.map(({ key, href }) => {
        const Icon = ICONS[key];
        return (
          <li key={key}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={LABELS[key]}
              className={cn(
                'flex items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600',
                box,
              )}
            >
              <Icon className={glyph} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
