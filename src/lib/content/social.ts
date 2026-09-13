/**
 * Turning what the office typed into a link that works.
 *
 * The admin screen asks for five URLs and gets whatever is to hand: a full
 * address pasted from the browser, a bare handle, a phone number with spaces
 * in it. Pure functions, so every one of those shapes is settled here and
 * tested, rather than discovered as a dead link on the live footer.
 *
 * A value that cannot be made into a link returns null, and the caller drops
 * the icon. An icon that goes nowhere is worse than no icon.
 */

export type SocialKey = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'whatsapp';

export interface SocialValues {
  facebook: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  whatsapp: string;
}

/** The bare domains, used to decide whether a value is already a full URL. */
const HOME: Record<Exclude<SocialKey, 'whatsapp'>, string> = {
  facebook: 'https://facebook.com/',
  instagram: 'https://instagram.com/',
  tiktok: 'https://tiktok.com/@',
  youtube: 'https://youtube.com/',
};

/**
 * A placeholder is not a link.
 *
 * The repository shipped `https://facebook.com/` and friends as stand-ins.
 * They are a valid URL and a useless destination — sending a visitor to
 * Facebook's home page is not "our Facebook page" — so they are treated as
 * unset until somebody fills the real one in.
 */
function isPlaceholder(url: string): boolean {
  const bare = url.replace(/\/+$/, '');
  return Object.values(HOME).some((home) => bare === home.replace(/\/+@?$/, ''));
}

export function socialHref(key: SocialKey, raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
  if (key === 'whatsapp') return whatsappHref(value);

  if (/^https?:\/\//i.test(value)) {
    return isPlaceholder(value) ? null : value;
  }
  // A handle, with or without its @.
  const handle = value.replace(/^@/, '');
  if (handle === '') return null;
  return `${HOME[key]}${handle}`;
}

/**
 * WhatsApp takes a number, not a name.
 *
 * `wa.me` wants digits only, with the country code and no `+`. A French number
 * typed as `07 56 85 79 64` is local, so it becomes `33756857964` — the
 * leading zero is dropped, which is exactly what dialling internationally
 * does and exactly what a naive strip of non-digits would get wrong.
 */
export function whatsappHref(raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
  if (/^https?:\/\//i.test(value)) return value;

  const digits = value.replace(/[^\d+]/g, '');
  if (digits === '') return null;

  if (digits.startsWith('+')) return `https://wa.me/${digits.slice(1)}`;
  if (digits.startsWith('00')) return `https://wa.me/${digits.slice(2)}`;
  // A French national number: 0X XX XX XX XX → 33XXXXXXXXX.
  if (digits.startsWith('0') && digits.length === 10) return `https://wa.me/33${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

/** The links worth drawing, in order, with the empty ones already removed. */
export function socialLinks(values: SocialValues): { key: SocialKey; href: string }[] {
  const keys: SocialKey[] = ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp'];
  return keys
    .map((key) => ({ key, href: socialHref(key, values[key]) }))
    .filter((link): link is { key: SocialKey; href: string } => link.href !== null);
}
