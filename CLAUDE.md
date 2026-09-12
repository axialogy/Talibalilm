# Talibalim — engineering notes

A learning platform for Institut Talib Alim: public catalogue, membership-style
access sold per module or per cursus, PayPal and cash-at-the-desk payment, an
office admin panel. Next.js 15 (App Router) on Vercel, Supabase Postgres,
Prisma alongside it, next-intl (French default, English under `/en`).

The rules below are the ones that are expensive to rediscover. Follow them.

## The one rule that cannot be relaxed

Access is decided **in the database**, by row-level security. There are 153 SQL
assertions in `supabase/tests/` and 9 Prisma RLS tests proving it: a student who
bought one module cannot read another, an expired entitlement grants nothing on
the clock, nobody can grant themselves access, and it all holds through a Prisma
connection that carries `BYPASSRLS`.

Several tasks are quicker to implement by relaxing a policy or reaching for the
service-role client. **Doing so is wrong**, not the test. If a change makes an
RLS assertion fail, the change is the bug. This is the one thing the codebase
does better than its competitors; do not trade it for a shortcut.

## Which client to use for a query

Two data-access paths exist. Pick by the job, and keep the boundary:

| Path | Use it for | Why |
|---|---|---|
| **Supabase client** (`@/lib/supabase/server`, `createClient()`) | auth, the public catalogue, every admin screen read | anon key, RLS applies; the policy tests already cover these reads |
| **Supabase admin** (`createAdminClient()`) | settling a verified PayPal capture, the sweep | service role, bypasses RLS — never reachable from unvalidated input |
| **`SECURITY DEFINER` RPC via the anon client** | admin grant/revoke, coupon generation | gated on `is_admin()` inside; `auth.uid()` stays the real admin, so the audit names them |
| **Prisma** (`@/lib/db/prisma`) | new admin/commerce/job code that wants a typed query builder | always `dbAs(userId, …)` except the webhook settlement path, which is the one place the owner connection is correct |

Prisma's schema is **introspected** from `supabase/migrations/` (`npm run db:pull`),
never the reverse. Prisma Migrate cannot model policies, column grants, partial
unique indexes, deferred constraint triggers or security-definer functions —
generating DDL from `schema.prisma` would silently drop the parts that keep the
paywall standing. Change the SQL, apply it, then `db:pull`.

## Schema changes

`supabase/migrations/*.sql` is the source of truth. One file per change, its RLS
policy in the same file as the table it protects. Never edit a migration that has
been applied to production; add a new one.

For a **fresh** project, `./supabase/bundle.sh` concatenates the migrations into
one paste-able file — pure SQL, no psql meta-commands, because the Supabase SQL
editor is not psql and rolls back the whole paste on one unknown line. For an
existing project, apply the new migration file(s) only.

`supabase/storage.sql` and `supabase/seed.sql` are separate first-install
scripts (storage touches Supabase's `storage` schema, which the offline test
harness does not have).

## Money

- Prices are integer cents. No float ever touches a price.
- The browser posts **ids**, never an amount. Every total is recomputed
  server-side from the catalogue (`priceSelection`). An e2e test asserts no
  input named for a price exists in the checkout.
- Currency comes from the products, not a constant. A mixed-currency basket is
  refused.
- Coupons and pack redemptions are claimed when the order **opens** and released
  on every failure path; the sweep (`/api/cron/sweep`) cancels abandoned
  checkouts. Releasing is idempotent by a stamp, not by running once.
- A refund/dispute webhook winds the entitlement back by the days that order
  bought — it does not delete it, because renewals stack.

## Testing

- `npm test` — unit (Vitest). Pure logic: pricing, validation, image sniffing.
- `npm run test:rls` — SQL policy assertions against a scratch Postgres. This is
  where the paywall is proven. Needs any reachable Postgres 15+.
- `npm run test:prisma` — Prisma RLS, from a role carrying `BYPASSRLS`.
- `npm run test:e2e` — Playwright against a production build.

A change to the schema or the money paths without a failing-then-passing test
has not been demonstrated.

## Deployment traps (learned the hard way)

**Vercel Hobby refuses a cron more frequent than daily — and it fails the whole
deployment, not just the cron.** `vercel.json` carried `*/15 * * * *` for eight
commits; every deploy died at the platform stage while `next build`, `npm ci`
and the full CI suite stayed green, because this rule is invisible to the build.
The site silently served a week-old commit. So `vercel.json` keeps a daily
schedule, and `.github/workflows/sweep.yml` drives the real ~15-minute cadence
by calling the endpoint (secrets `SWEEP_URL` + `CRON_SECRET`). If the project
ever moves to Pro, the Vercel cron can go back to `*/15 * * * *` and the
workflow can be deleted.

Pin the Node version. `engines.node` is `22.x` because `prisma generate` runs in
`postinstall` and Prisma 7 requires `^20.19 || ^22.12 || >=24`; unpinned, the
host picks its own default and the install can die before the build starts.

## Errors

Report through `reportError(context, error)` (`@/lib/observability/report`), not
a bare `console.error`. It is the seam Sentry forwards from once `SENTRY_DSN` is
set. The payment-critical paths (capture mismatch, webhook signature rejection)
already use it and should page someone.

## Optional integrations degrade, never crash

PayPal, Resend and Sentry are all optional at runtime. Unset, each is a logged
no-op: a student still gets access without a receipt, the payment page says
online payment is not configured. Losing a side effect must never lose the sale
or crash the page.

## Known gaps (audit, not yet built)

Shared rate limiting is now built (B8): `rate-limit.ts` calls the
`rate_limit_hit` Postgres RPC, so the counter is durable and shared across
serverless instances instead of living in one instance's memory. The limiter
fails open — a throttle-check outage must not take down login.

Still deferred, pending decisions from the school and its accountant: GDPR
erasure vs. record retention (B9, in progress) and real legal text. VAT and
invoices are intentionally **out of scope** — the school collects payment
through PayPal and treats tax there; no VAT is computed or invoiced in-app.
