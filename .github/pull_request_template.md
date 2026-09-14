## What this changes

<!-- One paragraph. What the reader will see differently, not a list of files. -->

## Why

<!-- The problem this solves. If it fixes a reported fault, name the symptom
     the office or a student actually saw. -->

## The verification gate

Every box is a command that was RUN, not one that should pass. An unchecked box
is fine and honest; a checked box that was not run costs the next person a day.

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run test:rls` — **required** for any change under `supabase/`, and for
      anything touching entitlements, orders or access. Needs a reachable
      Postgres 15+.
- [ ] `npm run build` — **never skip this.** A `'use server'` module exporting a
      non-async value passes tsc AND lint and fails only here. It has broken
      production once.
- [ ] `npm run test:e2e` (when the change touches checkout or the public site)

## Checked by hand

<!-- Which screen, as which role, and what you saw. "Admin → Modules → a module
     opens and the Cursus tab ticks." -->

## Database

- [ ] No schema change
- [ ] New migration in `supabase/migrations/`, RLS policy in the same file as the
      table it protects
- [ ] No migration already applied to production was edited — a new file was
      added instead
- [ ] `npm run db:pull` run if Prisma's schema needed to follow

## The rules this change did not break

- [ ] Access is still decided by RLS. No policy was relaxed and no service-role
      client was reached for to make a feature work.
- [ ] Every caught database, storage or network error carries
      `detail: errorDetail(error)` and an admin screen renders it through
      `<ActionError>`. (Exceptions: Zod failures, and anything a student sees.)
- [ ] No secret value appears in the diff, the description, or a screenshot —
      variable names only.
- [ ] Optional integrations (PayPal, SMTP, Sentry, R2) still degrade to a logged
      no-op rather than crashing when unset.

## Anything left undone

<!-- Say it here rather than letting the next person find it. -->
