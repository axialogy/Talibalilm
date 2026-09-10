# Brand assets

Everything here is a **placeholder** drawn in SVG so the site renders correctly
before the real artwork lands. Drop the supplied files in with the names below
and nothing in the code has to change — `src/components/Logo.tsx` tries the
raster file first and falls back to the SVG only when it 404s.

| Supplied artwork | Save it here | Used by |
|---|---|---|
| Gold calligraphy lockup + `INSTITUT TALIB ALIM` | `public/branding/logo-institut.png` | header, footer, login |
| Gold rounded-square app icon | `public/branding/logo-mark.png` | favicon, PWA icon, square slots |
| Grey mosque photograph | `public/media/hero-mosque.webp` | homepage hero |

`.webp` is preferred for the photograph (smaller at the same quality); `.png`
works too — change the constant at the top of `src/components/Logo.tsx` or
`src/components/home/Hero.tsx` if you use a different extension.

## Regenerating the PWA icons

`icon-192.png`, `icon-512.png` and `apple-touch-icon.png` are rendered from
`logo-mark.svg`. Once the real mark is in place, re-export them at 192, 512 and
180 px square — any image editor will do. They are referenced by
`public/manifest.webmanifest` and `index.html`, so the filenames must stay the
same.

`og.png` (1200×630) is the link-preview card used by `og:image`.

## Other artwork slots

| Path | Used by | If missing |
|---|---|---|
| `public/media/hero-mosque.svg` | homepage and page heroes | ships as a drawn placeholder |
| `public/media/approach.webp` | the dark band on the homepage | the emerald field stands on its own |

`approach.webp` is loaded as a CSS background rather than an `<img>` on
purpose: a missing background paints nothing, whereas a missing `<img>` would
leave a broken-image glyph across the band.
