# Talibalim

Learning platform for a language school in France, replacing a WordPress site
running Tutor LMS Pro and a custom WebRTC plugin (MeetPress).

**Phase 1 of 6 is complete.** See `docs/PHASE-1.md` for what works, what is
stubbed, and the open security items.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict |
| Styling | Tailwind CSS v4, tokens in `src/app/globals.css` |
| Database | Supabase Postgres, RLS on every table |
| Auth | Supabase Auth — password + magic link |
| i18n | next-intl — French (default, unprefixed) and Arabic (`/ar`, RTL) |
| Testing | Vitest (unit), Playwright (e2e), psql (RLS policies) |
| Hosting | Vercel |

Phases 3–5 add Stripe, LiveKit, Cloudflare R2, Bunny Stream and Resend. Their
env vars are already listed in `.env.example` so the deployment is configured
once.

---

## Running it

```bash
npm install
cp .env.example .env.local     # fill in the Supabase values
npm run dev                    # http://localhost:3000
```

The marketing site renders without Supabase configured — `supabaseConfigured`
in `src/lib/env.ts` degrades the auth surface instead of throwing, so the
catalogue is browsable before the project exists.

```bash
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint
npm test            # vitest
npm run test:e2e    # playwright, against a production build
npm run test:rls    # policy tests against a scratch Postgres
```

---

## Layout

```
src/
  app/
    [locale]/          every page; French unprefixed, Arabic under /ar
      (auth)/          login, register, forgot/reset password, verify
      courses/         catalogue and course detail
      dashboard/       Phase 1 stub — the real learning surface is Phase 2
      legal/[doc]/     terms, privacy, cookies
    auth/callback/     where every emailed link lands (outside [locale])
    actions/           server actions
  components/
    layout/            header, footer, logo, locale switcher
    marketing/         course card, generated cover art, page hero, filters
    auth/              forms
    ui/                button, field, badge
  lib/
    supabase/          browser, server and admin clients + generated types
    validation/        Zod schemas shared by form and server action
    content/           Phase 1 fixtures, shaped like the Phase 2 tables
  i18n/                routing, navigation, request config
messages/              fr.json and ar.json — every UI string
supabase/
  migrations/          schema; each table's RLS ships in the same file
  tests/               SQL policy tests + a local auth harness
ui-reference/          tokens.txt — the design source of truth
```

---

## The access-control model

The old site's security was "the plugin hides the button". This one is built
the other way round: the database refuses, and the app is merely polite about
it.

- Policies are written in the same migration as the table they protect.
- `public.user_role()`, `is_staff()` and `is_admin()` are `security definer`
  with a pinned `search_path`, so a policy on `profiles` can read `profiles`
  without recursing and without being hijacked by a caller-set search path.
- **RLS is row-level, so it cannot protect a column.** `profiles.role` is kept
  out of reach by a *column grant* — `authenticated` may update `full_name`,
  `phone` and `locale`, and nothing else. Without that, `profiles_update_own`
  would happily let a student set their own role to `admin`, because the row
  still belongs to them. `supabase/tests/rls_profiles.sql` asserts exactly
  this, against a real Postgres.
- The same constraint shapes Phase 2: the spec asks for lesson *titles* to be
  public while `content` and `video_id` stay members-only. That is two
  sensitivities in one row, which no single policy can express, so the gated
  fields move to their own `lesson_content` table with its own policy.

Run the policy tests with `npm run test:rls`. They need a reachable Postgres —
`supabase start`, or any local instance; see `supabase/tests/run.sh`.

---

## Design tokens

`ui-reference/tokens.txt` is the source of truth and `src/app/globals.css`
mirrors it. Correct a colour in both, never in a component.

Emerald carries every action. Gold is identity only — the logo, a hairline on
a cover — and never becomes a filled button, because two filled accents on one
screen stop telling the reader where to click. Ink is a green-black rather than
`#000`, which reads cold next to emerald on white.

The tokens were sampled from a screenshot of the live site; the `ui-reference/`
export described in the build spec was never delivered. Treat any value as
correctable.

## Brand assets

`public/branding/` holds SVG placeholders. `src/lib/artwork.ts` resolves the
real raster file when it exists and falls back to the placeholder otherwise —
on the **server**, so the correct URL is in the HTML. See
`public/branding/README.md` for the filenames.
