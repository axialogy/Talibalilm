# Branching

The site is live and a school depends on it. Until now every change went
straight onto `main`, which is also what Vercel deploys to production — so a
half-finished feature, a bad merge or a migration applied in the wrong order
reached the client's site the moment it was pushed. Twice the site silently
served a week-old commit because a deploy died at the platform stage while CI
stayed green.

This is the shape that fixes it. It costs one extra merge per change.

## The two long-lived branches

| Branch | What it is | Who writes to it |
|---|---|---|
| **`main`** | The live site. Vercel deploys production from here. | Nobody directly. Only a merge from `develop`. |
| **`develop`** | Integration. Everything lands here first and gets a Vercel preview URL. | Only a merge from a feature branch. |

Neither is written to by hand. Every change arrives through a pull request, and
CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, the SQL policy
tests and a full Playwright run against a production build on every one.

## How a change travels

```
feature branch  →  PR into develop  →  preview URL, checked by hand
                →  PR from develop into main  →  live
```

1. Branch off `develop`, never off `main`.
2. Push, open a PR **into `develop`**, fill in the template.
3. CI must be green. A red check is the work, not a formality.
4. Open the preview URL Vercel posts on the PR and look at the actual screen.
5. Merge into `develop`.
6. When `develop` is worth shipping, open one PR from `develop` into `main`.
   That merge is the release, and it is the only thing that touches the school's
   site.

If something on the live site is broken right now, a hotfix may branch off
`main` — and it must be merged back into **both** `main` and `develop`, or the
next release silently reverts it.

## Naming

```
fix/…      something is broken for a real person
feat/…     something the school asked for that does not exist yet
chore/…    infrastructure, dependencies, credentials, migrations
docs/…     documentation only
```

Lower case, hyphens, no ticket numbers. The name should say what it does:
`fix/admin-module-page-crash`, not `fix/bug-3`.

One branch does one thing. A branch that fixes the mail server and also adds a
date picker cannot be reviewed, cannot be reverted cleanly, and cannot be
shipped while half of it is still wrong.

## Rules that do not bend

**Never edit a migration that has been applied to production.** Add a new file.
Two branches each adding a migration will both merge cleanly and then run in
filename order — so check the order still makes sense after a merge, and
remember that Postgres refuses to *use* an enum value added in the same
transaction as the `alter type`.

**`npm run build` is part of every PR.** A `'use server'` module that exports a
non-async value passes `tsc` and `eslint` and fails only the build.

**Access is decided by RLS.** If a change makes an assertion in `supabase/tests/`
fail, the change is the bug, not the test.

**No secret values** in a diff, a commit message, a PR description or a
screenshot. Name the variable.

---

# The branches open now, and what belongs in each

Each one is cut from `develop`. The scope below is the whole of it — anything
else found along the way goes in its own branch.

### `fix/admin-module-page-crash` — P0

Admin → Modules → any module returns "Cette page n'a pas pu s'afficher" with
digest `2825006692`, for **every** course. The code path, not one bad row.

The cause is not yet identified, and must not be guessed. Get the real message
first: **Vercel → the deployment → Logs**, filter `REQUEST ERROR` — or, once
`20260914130000_app_errors.sql` is applied, paste the digest into
**Admin → Diagnostic**.

Already ruled out by reading, do not search here again: the page's own
`courseError` branch (it renders a red box, not a crash), `Tabs`,
`CourseCursus`, `CourseOutline`, `CourseSettingsForm`, `CourseFees`,
`readBullets`/`readHighlights`/`readGallery`, `toCourse`, and `title_ar` (the
column is `not null default ''`).

Worth checking: the `lesson_content` select naming `video_bytes` and
`video_expires_at`, which exist only after `20260914110000_lesson_video_upload.sql`.

Files: `src/app/[locale]/admin/courses/[id]/page.tsx` and whatever the stack
names.

### `fix/smtp-mail-delivery` — P0

Outgoing mail is dead. `SMTP_HOST` is `mail.talibalim.com`, which has **no DNS
record**; every send fails with `getaddrinfo EBUSY`. Verified:

```
mail.talibalim.com     → NO RECORD      ← what SMTP_HOST points at
smtp.talibalim.com     → NO RECORD
webmail.talibalim.com  → 91.121.51.179  (OVH)
talibalim.com          → 216.198.79.1   (Vercel — the website)
MX talibalim.com       → 10 talibalim.com → the website
```

The code side already shipped: `SMTP_SERVERNAME` lets `SMTP_HOST` be an IP while
TLS still verifies the certificate's name, and
**Admin → Diagnostic → « Tester d'autres serveurs d'envoi »** reports which host
accepts the credentials. **Nobody has run it on the deployment yet.** Whatever it
names goes into Vercel `SMTP_HOST` *and* Supabase → Authentication → SMTP.

Never set `rejectUnauthorized: false`. `tests/unit/smtp-host.test.ts` forbids it.

Inbound is a **DNS change the owner must make**: the MX points at the website's
Vercel IP, so mail *to* `contact@talibalim.com` is delivered nowhere. Not
fixable in code — this branch only covers sending.

Files: `src/lib/email/send.ts`, `.env.example`.

### `chore/db-migrations-catchup` — P0

Several migrations may never have been applied to the live Supabase project.
Confirm and apply before diagnosing anything else:

```
20260913190000_registration_seen.sql
20260913200000_push_subscriptions.sql
20260914100000_coupons_without_pgcrypto.sql     the coupon generator fix
20260914110000_lesson_video_upload.sql
20260914120000_seed_the_two_cursus.sql
20260914130000_app_errors.sql                   the crash log + digest lookup
```

`./supabase/bundle.sh` is for a **fresh** project. For this existing one run
`./supabase/catchup.sh` — one re-runnable idempotent script, pure SQL with no
psql meta-commands, because the Supabase SQL editor is not psql and rolls back
the whole paste on one unknown line. It ends with a SELECT printing `ok` /
`MISSING` per table, function and column. **Read that output.**

Two traps, each already paid for: pgcrypto lives in Supabase's `extensions`
schema so a function pinned to `search_path = public, pg_temp` cannot see
`gen_random_bytes`; and Postgres refuses to *use* an enum value added in the
same transaction. Finish with `notify pgrst, 'reload schema';`.

### `feat/cursus-from-module-page` — P1

Create a cursus without leaving the module builder. Goes in the Cursus tab of
`/admin/courses/[id]`. The two-box UI is `src/components/admin/CourseCursus.tsx`
(Par module · Cursus Approfondi with Années 1–5); `setCursusYear` in
`src/app/actions/catalog.ts` maintains the rows for both delivery modes.

### `feat/live-class-date-time` — P1

Split the live-class datetime into **separate date and time pickers** — the
owner chose this explicitly. Admin → Cours en direct.

### `feat/slides-images-pdf-only` — P1

Slides accept images and PDF only; a `.pptx` is refused with a message telling
the user to export as PDF. And fix **"La conversion du PDF a échoué dans ce
navigateur"** — reproduce it, get the real error, fix it. The error keys
`pdfCorrupt`, `pdfEmpty`, `pdfEngine`, `pdfPassword` and `convertToPdf` already
exist in `messages/{fr,en}.json`.

### `chore/rotate-exposed-credentials` — P2, before taking real money

Three credentials were exposed in working sessions and are still live:

- the **Ably root API key** — revoke it at ably.com; nothing uses it any more,
  so delete `ABLY_API_KEY` from Vercel
- the **Supabase database password** — rotate, then update `DATABASE_URL` and
  `DIRECT_URL`
- the **Supabase service-role key** — rotate; it bypasses every policy

Then audit Vercel: `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_SECRET`, every
`R2_*`, `PAYPAL_CLIENT_SECRET`, `CRON_SECRET`, `SMTP_PASSWORD` and
`VAPID_PRIVATE_KEY` must be **Secret** type and must never carry a
`NEXT_PUBLIC_` prefix.

This branch will carry almost no code. Its PR is the record that it was done.

---

## Older branches

`feat/phase-1-foundation` is fully merged into `main` and can be deleted.
`feat/institut-talib-alim-frontend` (10 September) was **never merged** and has
been superseded by later work — read it before deleting it, in case something
in it was wanted.
