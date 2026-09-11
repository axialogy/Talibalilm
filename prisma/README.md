# Prisma

Postgres was always the database — Supabase *is* Postgres. What changed is that
Prisma now sits alongside the Supabase client, and how it does so is the part
worth reading before touching anything here.

## The problem Prisma creates, and how it is handled

Prisma's ordinary mode is to connect as a privileged role and let application
code decide who may see what. That would be a serious mistake in this codebase.
Every table carries row-level security policies, and 105 assertions in
`supabase/tests/` prove things like *a student who bought the fiqh module
cannot read the aqida module* and *nobody can grant themselves an entitlement*.
Connecting as an owner makes all of that decorative and moves the paywall into
whichever `where` clause someone remembers to write.

Worse, on Supabase Prisma connects as `postgres`, and **that role carries
BYPASSRLS**. Left alone, Prisma would see everything.

So `src/lib/db/prisma.ts` exposes two things, and the difference is the whole
design:

| | Sees | For |
|---|---|---|
| `db` | everything, RLS bypassed | work no user performs on their own behalf: settling a verified PayPal capture, the nightly expiry sweep |
| `dbAs(userId, …)` | exactly what that person may see | anything driven by a request |

`dbAs` opens a transaction and runs:

```sql
select set_config('request.jwt.claims', '{"sub":"…","role":"authenticated"}', true);
set local role authenticated;
```

which is precisely what Supabase's own API does per request. `auth.uid()` then
returns that id and every policy applies unchanged. `SET LOCAL` is scoped to
the transaction, so the connection returns to the pool as itself — a leaked
`SET ROLE` on a pooled connection would hand the next request someone else's
identity, which is worse than anything RLS protects against.

`dbAsAnon` is the same for a signed-out visitor.

## This is tested, not asserted

`tests/unit/prisma-rls.test.ts` runs against real Postgres with the real
migrations, **from a login role that carries BYPASSRLS** — because that is what
Prisma really is on Supabase. Testing against a role that cannot bypass RLS
would prove nothing. Among the assertions:

- a buyer who owns fiqh gets `[]` for aqida content, *through Prisma*;
- `findMany()` with no `where` returns only what they own — the classic ORM
  leak cannot happen, because the filtering is below Prisma;
- a `SET ROLE` does not survive the transaction.

```bash
npm run test:prisma     # provisions a scratch database and runs them
```

It skips silently when no database is reachable, and **must never be made to
pass by loosening a policy**.

## Migrations stay in SQL

`supabase/migrations/*.sql` remains the source of truth. `prisma/schema.prisma`
is *introspected* from it (`npm run db:pull`), never the other way round.

That is deliberate. Policies, column-level grants, partial unique indexes,
deferred constraint triggers and security-definer functions are most of what
makes this schema safe, and Prisma Migrate models none of them. Generating DDL
from `schema.prisma` would quietly drop the parts that matter.

So: **change the SQL, apply it, then `npm run db:pull`.**

## Connection strings

Prisma needs a real Postgres connection, which the Supabase client did not.

```
DATABASE_URL   transaction pooler, port 6543, ?pgbouncer=true
DIRECT_URL     direct or session pooler, port 5432
```

On Vercel, `DATABASE_URL` **must** be the transaction pooler. A serverless
function cannot hold a connection open between invocations, and pointing it at
the direct connection exhausts the database's slots under any real traffic.

Migrations and `db pull` need the unpooled one: the transaction pooler holds no
session state, so DDL and advisory locks fail through it in ways that are hard
to read.

```bash
DATABASE_URL="$DIRECT_URL" npm run db:pull
```

## What still goes through the Supabase client

Authentication, and the reads already covered by the policy tests. Supabase Auth
issues the JWT that `dbAs` hands to Postgres, so the two are not alternatives —
the session is what makes the Prisma path safe.
