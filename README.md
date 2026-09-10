# Grow & Glow

A youth lifestyle store — fashion, self-expression, and light emotional support.
Storefront plus a full admin dashboard, built from the brand book.

> growth is a journey, not a solution.

---

## The idea, in three parts

**Reverse typography.** Every piece carries a message printed backwards. On the
hanger it reads as a graphic; in the mirror it reads as a sentence — one that
arrives exactly when you are already looking at yourself. The site renders this
literally: product art mirrors the message, and a "hold up the mirror" toggle
flips it back.

**Hidden QR.** Each garment's care label carries a code. Scanning it opens
`/unlock?code=…` with a note, a playlist, or a community link tied to that
piece. Codes and their content are managed in the dashboard, with scan counts.

**Soft healing glow, mirrored by reality.** Drifting pastel gradients for the
calm; high-contrast reflective surfaces for the honesty. The colour temperature
stays warm throughout — cold would read as clinical, and this brand is
explicitly a friend, not a therapist.

---

## Stack

| | |
|---|---|
| Build | Vite 7 · TypeScript 5.9 |
| UI | React 19 · Tailwind CSS 3.4 · shadcn/ui (Radix) |
| Routing | TanStack Router (file-based, hash history) |
| Charts | Recharts |
| Backend | Supabase — **optional**, see below |
| State | React context + `localStorage` |

Hash history means the built `dist/` runs on any static host with no rewrite
rules: GitHub Pages, Netlify drop, Vercel, or a plain folder.

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

Storefront at `http://localhost:3000`, dashboard at `http://localhost:3000/#/admin`.

```bash
npm run build
```

---

## Dashboard

`/#/admin` — demo credentials:

```
admin@growandglow.dz / glow2026
```

| Screen | What it does |
|---|---|
| Overview | Revenue, orders, pending count, 14-day chart, best sellers |
| Orders | Status workflow, expandable detail, WhatsApp link, CSV export |
| Products | Full editor — sizes, colourways, bundles, photos, mirror message, unlock code |
| Drops | Seasonal collections with a statement line and publish toggle |
| Reviews | Approve, unpublish, delete; bulk approve |
| Journal | Write and publish notes; read time auto-estimated |
| Unlock codes | Manage QR targets, copy the printable URL, watch scan counts |
| Customers | Built automatically from orders, sorted by spend |
| Settings | Brand name, accent colour, contact, delivery pricing, announcement bar |

> **The login is client-side only.** It keeps the dashboard out of the way of
> ordinary visitors, but anyone reading the JS bundle can find the credentials.
> Before running a real store, move it behind Supabase Auth and tighten the RLS
> policies — `supabase_schema.sql` marks exactly which block to replace.

---

## Supabase (optional)

Without env vars the app runs entirely from `localStorage` — every feature
works, the data just lives in that one browser.

To turn on the shared backend:

1. Run [`supabase_schema.sql`](supabase_schema.sql) in the SQL editor.
2. Create a **public** Storage bucket called `product-images` and add the two
   policies noted at the bottom of that file.
3. Add the env vars:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

The first time you open the dashboard with Supabase on, the local catalog is
pushed up automatically, so nothing is lost in the switch.

**Egress design.** A visitor makes four small GETs per load (products, drops,
published reviews, published posts) via plain `fetch` — the ~100 KB supabase-js
client is dynamically imported and never lands in the main bundle. Photos come
from the Storage CDN. Admin notifications are one websocket carrying INSERT
events. Nothing polls.

---

## Product art

Products with no uploaded photo render as generated SVG: the garment silhouette
in its selected colourway, over the brand's pastel wash, with the piece's own
message printed backwards across the chest. So the shop looks finished before a
single photo exists, and the reverse-print idea is visible from the first
screen. Uploaded photos always take over.

Uploads are downscaled to 1200px and re-encoded as JPEG in the browser before
they go anywhere — a 4 MB phone photo lands at roughly 120 KB.

---

## Languages

English (default, LTR) and Arabic (RTL). English ships in the main bundle;
Arabic is fetched on first switch. `ar.ts` is typed against `en.ts`, so adding
an English key fails the build until it is translated.

Direction is handled with logical CSS properties, so one set of classes serves
both. Fonts: Playfair Display for display type, Geist for body, Tajawal for
Arabic — all self-hosted, nothing render-blocking on a third party.

---

## Project layout

```
src/
├── components/
│   ├── admin/AdminUI.tsx     Shared dashboard primitives
│   ├── shop/                 ProductCard, ReviewsSection
│   ├── MirrorText.tsx        Reverse typography + interactive mirror
│   ├── Navbar.tsx  Footer.tsx  Logo.tsx  LanguageSwitcher.tsx
├── context/GlowStore.tsx     All state and actions
├── data/seed.ts              Catalog, drops, journal, unlock codes
├── i18n/                     en.ts (source of truth) · ar.ts · index.tsx
├── lib/
│   ├── productArt.ts         Generated garment SVGs
│   ├── pricing.ts            Bundles, delivery, currency
│   ├── supabaseSync.ts       Every remote read and write
│   ├── images.ts  slug.ts  wilayas.ts  orderStatus.ts
├── routes/                   File-based routes (storefront + /admin/*)
└── types/index.ts            Domain model
```

---

## Accessibility

Focus rings are restyled, never removed. Mirrored text is flipped with a CSS
transform, so the real sentence stays in the DOM for screen readers, search
engines and copy-paste. Touch targets meet 44px. Every decorative gradient is
`aria-hidden` and stops moving under `prefers-reduced-motion`. Tables scroll
inside their own container so the page body never scrolls sideways.
