import { Facebook, Instagram, Youtube } from 'lucide-react';
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

/**
 * WhatsApp, like TikTok, is a brand mark rather than a symbol — Lucide carries
 * neither. The stand-in here was Lucide's `MessageCircle`, which reads as an
 * empty speech bubble and named no app at all. This is the real glyph: the
 * handset inside the bubble is part of the same path, so it fills solid and
 * inherits colour and size from the same classes as its neighbours.
 */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.67c2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24zM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.86.84-.86 2.05s.89 2.38 1.01 2.54c.12.17 1.73 2.76 4.25 3.76.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29-.24-.13-1.46-.72-1.69-.8-.22-.09-.39-.13-.55.12-.16.25-.63.8-.77.96-.14.17-.28.19-.53.06-.24-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.24-.02-.38.11-.5.11-.11.24-.29.37-.43.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.44-.06-.12-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.42h-.47z" />
    </svg>
  );
}

const ICONS: Record<SocialKey, (props: { className?: string }) => React.ReactNode> = {
  facebook: ({ className }) => <Facebook className={className} aria-hidden="true" />,
  instagram: ({ className }) => <Instagram className={className} aria-hidden="true" />,
  tiktok: TikTokIcon,
  youtube: ({ className }) => <Youtube className={className} aria-hidden="true" />,
  whatsapp: WhatsAppIcon,
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
              // A glyph names itself to a screen reader through the label
              // above and to everyone else through the tooltip. Without this,
              // hovering an icon told a sighted visitor nothing.
              title={LABELS[key]}
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
