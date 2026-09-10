# Phase 1 — Foundation

Status: **complete**. Nothing from phases 2–6 has been scaffolded.

---

## What works

**Auth.** Register, email verification, login, magic link, forgot/reset
password, sign out. Server actions re-validate every input with the same Zod
schema the form used. `/auth/callback` handles both the PKCE (`code`) and
token-hash flows, so it works whichever email template the Supabase project
is on.

**Database.** One migration: `profiles`, provisioned by an `after insert`
trigger on `auth.users`, with RLS enabled and forced, three `security definer`
role helpers, and column grants that keep `role` out of the client's reach.
16 policy assertions run against a real Postgres 16 and pass — including a
student's attempt to promote themselves to admin, which is refused.

**i18n.** French (unprefixed) and Arabic (`/ar`), both complete: 213 keys each,
with a unit test that fails the build if a key or an ICU placeholder exists in
one locale and not the other. RTL is real — the whole layout mirrors, and
headings fall back to Tajawal because Poppins has no Arabic glyphs.

**Public site.** Home, `/courses` with URL-driven filters, `/courses/[slug]`
with the syllabus listed and locked, `/pricing`, three legal pages. All
statically generated in both locales; course pages carry `revalidate = 3600`.
`Course` and `EducationalOrganization` JSON-LD, `hreflang` alternates, sitemap
covering both locales, robots.

**Tests.** 11 unit, 36 e2e (desktop + mobile), 16 SQL policy assertions. All
green. CI runs the three suites in separate jobs.

---

## What is stubbed

| Thing | State |
|---|---|
| `/dashboard` | Renders the signed-in profile and a sign-out button. Phase 2 replaces it. |
| Course data | Fixtures in `src/lib/content/courses.ts`, shaped like the Phase 2 tables. Every read goes through accessors, so the swap is one file. |
| Legal pages | Routes and titles exist; the text says it is being drafted and is `noindex`. Real terms have to come from the school's counsel. |
| Course covers | Generated SVG (`CourseArt`). `cover_url` takes over when the school uploads art. |
| `/media/approach.webp` | Absent. Loaded as a CSS background so a missing file paints nothing rather than a broken-image glyph. |
| Migration script | Phase 2 — it needs `ui-reference/content/`, which was never delivered. |

---

## Security concerns

**1. Rate limiting is not real yet.** `src/lib/rate-limit.ts` keeps counters in
module scope, so it throttles one attacker against one warm serverless
instance and nothing more. Spec §8 asks for rate limiting on auth, coupon
redemption and checkout; only auth is wired, and only weakly. Supabase Auth's
own per-project limits are the actual backstop today. Before launch this needs
Upstash Redis or a Postgres-side counter — and it must be in place *before*
Phase 3, because coupon redemption is where brute force actually pays.

**2. Column-level protection is a grant, not a policy.** The `role` column is
safe because `authenticated` has no `UPDATE` privilege on it. That is correct
but easy to undo: a future migration that runs `GRANT UPDATE ON profiles TO
authenticated` re-opens privilege escalation silently. The policy test would
catch it, which is why that test matters more than it looks.

**3. `service_role` has no audit trail yet.** `createAdminClient()` bypasses
RLS entirely. Nothing calls it yet. Spec §8 wants an audit log for admin
actions on memberships, coupons and refunds — that table should land in
Phase 3 alongside the first real caller, not after it.

**4. Legal pages are placeholders.** GDPR needs a real privacy policy before
any student data is collected in production. The routes are `noindex` so
placeholder text cannot be indexed as the real policy, but this blocks launch,
not Phase 2.

### Found in MeetPress while reading it

Ported features are listed in §5 of the spec; these are the defects that came
with them, recorded so they are not reproduced:

- **Signalling was authenticated but not authorised.** `signal_push` and
  `signal_poll` used `permission_callback => is_user_logged_in()`. Any
  logged-in account with a room token could read offers, chat, whiteboard
  strokes and slide images without buying anything. The waiting room was
  decorative. LiveKit tokens minted server-side after a membership check fix
  this by construction.
- **Recordings were world-readable.** `get_recordings` returned a public
  `wp-content/uploads` URL; the `.htaccess` was `Options -Indexes`, which
  blocks listing but not direct access. Confirms the spec's §5 note.
- **Anyone logged in could upload a recording** against any `meeting_id`.
- **Slides evicted signalling.** Base64 images shared one 100-message transient
  buffer with offers/answers/ICE, so a few slides could drop the messages a
  joining peer needed.

MeetPress also has a **waiting room with host approve/reject**
(`meetpress_join_requests`) that §5 does not mention. Say whether to keep it.

---

## What I would do differently

**`typedRoutes` is off.** It types the filesystem routes, which under next-intl
all sit beneath `[locale]`, while next-intl's `Link` and `redirect` take
locale-less paths. They never agree and every call site needs a cast, which is
worse than no typing. Route-level safety comes back properly via next-intl's
`pathnames` config — worth doing when the URL segments get localised
(`/cours`, `/الدورات`), which is a decision for the school.

**Course titles are not translated.** The spec's `courses` table has single
`title` / `description` columns plus a `language` column for the language
*taught*. So an Arabic-speaking visitor sees French course titles. That is what
the schema says, and it may well be right for a French school — but it is a
product decision, not an oversight, and now is the cheap moment to change it
(a `course_translations` table) if it is wrong.

**Vitest is pinned to 3, not 4.** Vitest 4 triggers an `npm` peer-resolution
crash (`Cannot read properties of null (reading 'edgesOut')`) in this
environment. Vitest 3 is unaffected. Worth retrying on a newer npm.

**The unit suite has no component tests.** `@vitejs/plugin-react` and
`vite-tsconfig-paths` currently resolve a newer Vite than Vitest's own, and the
two `Plugin` types are incompatible enough to break typechecking. Since the
Phase 1 tests exercise schemas and message catalogues rather than components,
both plugins were dropped. Add the React plugin back — pinned to Vitest's Vite
major — when component tests arrive.

---

## Before this can deploy

Vercel and Supabase both need accounts I cannot create. The steps:

1. **Supabase project, EU region** (spec §8 — student data must stay in the
   EU). Copy the URL, anon key and service-role key into Vercel's env.
2. **Apply the migration**: `supabase link` then `supabase db push`, or paste
   `supabase/migrations/20260910120000_profiles.sql` into the SQL editor.
3. **Auth → URL Configuration**: set Site URL and add
   `https://<domain>/auth/callback` to the redirect allow-list. `siteUrl()`
   and that list have to agree or every emailed link breaks.
4. **Vercel project** pointed at this repo, env vars from `.env.example`, and
   `NEXT_PUBLIC_SITE_URL` set to the production domain.
5. Regenerate types once the schema is live: `npm run db:types`.

Until step 1, the site still builds and the public pages still render.
