/**
 * Generated product art.
 *
 * The shop needs to look complete before anyone uploads a photo, and a flat
 * grey placeholder would sell the idea short — the whole point of a piece is
 * the reverse-printed message. So an unphotographed product renders as an SVG
 * garment in its own colourway with its own message printed backwards on the
 * chest, over the brand's pastel wash.
 *
 * Admin-uploaded photos always win; this is only the fallback.
 */
import type { ProductCategory } from '@/types';

/** Garment outlines, drawn on a 400 × 480 canvas. */
const SILHOUETTES: Record<ProductCategory, { body: string; extras: string }> = {
  tee: {
    body:
      'M140 62 L104 74 L54 116 L92 172 L118 148 L118 432 Q200 448 282 432 L282 148 L308 172 L346 116 L296 74 L260 62 Q200 104 140 62 Z',
    extras:
      '<path d="M140 62 Q200 104 260 62" fill="none" stroke="rgba(26,26,26,.16)" stroke-width="2.5"/>' +
      '<path d="M118 148 L118 432" fill="none" stroke="rgba(26,26,26,.06)" stroke-width="2"/>',
  },
  hoodie: {
    body:
      'M146 78 L104 90 L52 132 L90 190 L116 166 L116 442 Q200 458 284 442 L284 166 L310 190 L348 132 L296 90 L254 78 Q200 136 146 78 Z',
    extras:
      // hood
      '<path d="M146 78 Q200 136 254 78 Q240 34 200 30 Q160 34 146 78 Z" fill="rgba(26,26,26,.10)"/>' +
      '<path d="M146 78 Q200 136 254 78" fill="none" stroke="rgba(26,26,26,.20)" stroke-width="2.5"/>' +
      // kangaroo pocket
      '<path d="M138 306 L262 306 L272 380 L128 380 Z" fill="none" stroke="rgba(26,26,26,.16)" stroke-width="2.5"/>' +
      // drawcords
      '<path d="M178 96 L174 168" stroke="rgba(255,255,255,.75)" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      '<path d="M222 96 L226 168" stroke="rgba(255,255,255,.75)" stroke-width="4" stroke-linecap="round" fill="none"/>',
  },
  crewneck: {
    body:
      'M144 72 L104 84 L54 126 L92 184 L118 160 L118 438 Q200 454 282 438 L282 160 L308 184 L346 126 L296 84 L256 72 Q200 120 144 72 Z',
    extras:
      // ribbed collar
      '<path d="M144 72 Q200 120 256 72 Q248 52 200 50 Q152 52 144 72 Z" fill="rgba(26,26,26,.12)"/>' +
      // ribbed hem
      '<path d="M118 406 Q200 422 282 406 L282 438 Q200 454 118 438 Z" fill="rgba(26,26,26,.08)"/>',
  },
  cap: {
    body: 'M62 258 Q62 122 200 122 Q338 122 338 258 Q200 282 62 258 Z',
    extras:
      // brim
      '<path d="M40 258 Q200 292 360 258 Q356 300 200 318 Q44 300 40 258 Z" fill="rgba(26,26,26,.14)"/>' +
      // panel seams
      '<path d="M200 122 L200 268" stroke="rgba(26,26,26,.14)" stroke-width="2.5" fill="none"/>' +
      '<path d="M130 134 Q150 200 148 264" stroke="rgba(26,26,26,.10)" stroke-width="2" fill="none"/>' +
      '<path d="M270 134 Q250 200 252 264" stroke="rgba(26,26,26,.10)" stroke-width="2" fill="none"/>' +
      '<circle cx="200" cy="126" r="9" fill="rgba(26,26,26,.16)"/>',
  },
  accessory: {
    body: 'M112 168 L288 168 L306 436 L94 436 Z',
    extras:
      '<path d="M152 168 Q152 92 200 92 Q248 92 248 168" fill="none" stroke="rgba(26,26,26,.28)" stroke-width="9" stroke-linecap="round"/>',
  },
};

/** Where the printed message sits, per garment. */
const PRINT_ANCHOR: Record<ProductCategory, { x: number; y: number; size: number; width: number }> = {
  tee: { x: 200, y: 250, size: 25, width: 150 },
  hoodie: { x: 200, y: 250, size: 23, width: 148 },
  crewneck: { x: 200, y: 258, size: 24, width: 150 },
  cap: { x: 200, y: 205, size: 19, width: 120 },
  accessory: { x: 200, y: 300, size: 25, width: 160 },
};

/** Escape the five XML entities so a message can never break the markup. */
function xml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Greedy word wrap. `charWidth` approximates Playfair's average advance at
 * the given size, which is close enough for a placeholder.
 */
function wrap(text: string, size: number, maxWidth: number, maxLines: number): string[] {
  const charWidth = size * 0.46;
  const perLine = Math.max(6, Math.floor(maxWidth / charWidth));
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= perLine) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.length > 0 ? lines : [text.slice(0, perLine)];
}

/** Lighten a hex colour toward white, for the fabric's lit edge. */
function lighten(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Darken a hex colour, for the fabric's shadow side. */
function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c * (1 - amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Relative luminance, to decide whether the print reads black or white. */
function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.42;
}

export interface ProductArtOptions {
  category: ProductCategory;
  /** Garment colourway */
  color: string;
  /** The reverse-printed message. Omitted renders a blank garment. */
  message?: string;
  /**
   * When false the message renders the right way round — used by the
   * "hold up the mirror" toggle on the product page.
   */
  reversed?: boolean;
  /** Unique-ish string so gradient ids never collide across inlined SVGs */
  seed?: string;
}

/**
 * Build the SVG source for one product. Exported separately from the data URI
 * so callers that want to inline the markup (and animate it) can.
 */
export function productArtSvg(opts: ProductArtOptions): string {
  const { category, color, message, reversed = true, seed = 'a' } = opts;
  const shape = SILHOUETTES[category] ?? SILHOUETTES.tee;
  const anchor = PRINT_ANCHOR[category] ?? PRINT_ANCHOR.tee;
  const id = `g${seed.replace(/[^a-z0-9]/gi, '').slice(0, 10) || 'x'}`;

  const ink = isDark(color) ? 'rgba(255,255,255,.94)' : 'rgba(26,26,26,.86)';
  const lines = message ? wrap(message, anchor.size, anchor.width, 3) : [];
  const lineHeight = anchor.size * 1.24;
  const startY = anchor.y - ((lines.length - 1) * lineHeight) / 2;

  const printedText = lines
    .map(
      (line, i) =>
        `<text x="${anchor.x}" y="${(startY + i * lineHeight).toFixed(1)}" text-anchor="middle" ` +
        `font-family="Playfair Display, Georgia, serif" font-size="${anchor.size}" ` +
        `font-style="italic" fill="${ink}">${xml(line)}</text>`,
    )
    .join('');

  // The whole print block is mirrored about the garment's centre line, which
  // is exactly what happens on the real product.
  const print = lines.length
    ? `<g transform="${reversed ? `translate(${anchor.x * 2},0) scale(-1,1)` : ''}">${printedText}</g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480" width="400" height="480" role="img">
<defs>
<linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#e6dfea"/><stop offset="45%" stop-color="#f2e6e3"/><stop offset="100%" stop-color="#dfe3ee"/>
</linearGradient>
<linearGradient id="${id}f" x1="0.15" y1="0" x2="0.85" y2="1">
<stop offset="0%" stop-color="${lighten(color, 0.16)}"/>
<stop offset="52%" stop-color="${color}"/>
<stop offset="100%" stop-color="${darken(color, 0.14)}"/>
</linearGradient>
<radialGradient id="${id}h" cx="0.3" cy="0.16" r="0.75">
<stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>
<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>
<filter id="${id}n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/><feColorMatrix type="saturate" values="0"/></filter>
<clipPath id="${id}c"><path d="${shape.body}"/></clipPath>
</defs>
<rect width="400" height="480" fill="url(#${id}bg)"/>
<circle cx="86" cy="96" r="118" fill="#b0a8be" opacity="0.30"/>
<circle cx="330" cy="392" r="132" fill="#ddcfbb" opacity="0.28"/>
<rect width="400" height="480" filter="url(#${id}n)" opacity="0.10"/>
<path d="${shape.body}" fill="url(#${id}f)"/>
<g clip-path="url(#${id}c)"><rect width="400" height="480" fill="url(#${id}h)"/></g>
${shape.extras}
${print}
<path d="${shape.body}" fill="none" stroke="rgba(26,26,26,.22)" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;
}

/** Same art, as a data URI ready for an <img src>. */
export function productArtUri(opts: ProductArtOptions): string {
  return `data:image/svg+xml,${encodeURIComponent(productArtSvg(opts))}`;
}

/**
 * The image to show for a product: its first uploaded photo, or generated art.
 * `index` lets a gallery ask for alternate colourways.
 */
export function productImage(
  product: {
    images?: string[];
    category: ProductCategory;
    colors?: { name: string; hex: string }[];
    mirrorMessage?: string;
    id: string;
  },
  index = 0,
): string {
  const uploaded = product.images ?? [];
  if (uploaded[index]) return uploaded[index];

  const colors = product.colors ?? [];
  const color = colors[index % Math.max(colors.length, 1)]?.hex ?? '#e0cdc9';
  return productArtUri({
    category: product.category,
    color,
    message: product.mirrorMessage,
    seed: `${product.id}${index}`,
  });
}

/** How many images a product gallery should show. */
export function productImageCount(product: {
  images?: string[];
  colors?: { name: string; hex: string }[];
}): number {
  const uploaded = (product.images ?? []).length;
  if (uploaded > 0) return uploaded;
  return Math.max((product.colors ?? []).length, 1);
}
