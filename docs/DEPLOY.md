# Deploying to Vercel

Two accounts are needed and neither can be created from here: **Supabase** (the
database) and **Vercel** (the hosting). Everything else is done.

The site builds and the public pages render *before* Supabase exists — the
catalogue falls back to fixture data — so you can deploy first and connect the
database second if you prefer.

---

## 1. Supabase project

Create it at https://supabase.com/dashboard — **choose an EU region**
(Frankfurt or Paris). The school operates in France and GDPR requires student
data to stay in the EU. This cannot be changed later without migrating.

From **Project Settings → API**, copy three values:

| Value | Goes to |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` — **server only** |

The anon key is safe in the browser: what it can do is decided by the RLS
policies, which is the whole design. The service-role key bypasses RLS
entirely — never prefix it `NEXT_PUBLIC_`.

## 2. Apply the migrations

Either with the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or paste each file from `supabase/migrations/` into the SQL editor, **in
filename order**:

1. `20260910120000_profiles.sql`
2. `20260910140000_courses.sql`

Do **not** apply anything from `supabase/tests/` — `00_local_harness.sql` fakes
the `auth` schema for offline testing and would collide with Supabase's real one.

## 3. Auth redirect URLs

**Authentication → URL Configuration**:

- **Site URL**: `https://your-domain.com`
- **Redirect URLs**: add `https://your-domain.com/auth/callback`

If this list and `NEXT_PUBLIC_SITE_URL` disagree, every verification and
password-reset link breaks. Add your Vercel preview domain too if you use
previews.

## 4. Vercel project

Import the repo at https://vercel.com/new. Framework detection handles the
rest — there is no `vercel.json` to write.

Environment variables (**Production** and **Preview**):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

On previews, leave `NEXT_PUBLIC_SITE_URL` unset — the app falls back to
`VERCEL_URL`, which is the only value that is correct per-deployment.

## 5. First admin

Everyone is created as `student`; the signup trigger ignores any role in the
client-supplied metadata, on purpose. Promote yourself once, from the Supabase
SQL editor:

```sql
update public.profiles set role = 'admin' where id = (
  select id from auth.users where email = 'you@example.com'
);
```

Then `/admin/courses` opens and you can build the first course.

## 6. Give yourself a membership to test the gate

Until Phase 3 there is no purchase flow, so grant one by hand:

```sql
insert into public.memberships (user_id, expires_at)
select id, now() + interval '365 days' from auth.users where email = 'you@example.com';
```

Sign in and open a locked lesson — it should render. Sign out and open the same
URL — you should be sent to the login page. Open the course page signed out and
the syllabus is visible but no video id appears anywhere in the payload.

## 7. Regenerate the database types

`src/lib/supabase/database.types.ts` is hand-written to match the migrations.
Once the schema is live, replace it with the generated version:

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

---

## Verifying the deployment

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run test:e2e     # needs a local Postgres for test:rls, not for this
npm run test:rls     # policy tests — needs any reachable Postgres 15+
```

With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` present in
the environment, `test:e2e` additionally runs the four REST-API tests that hit
PostgREST with the public anon key the way an attacker would. Without them
those four skip, and the SQL policy tests carry the same guarantee.

---

## Not yet wired

`.env.example` lists the keys for Stripe, Resend, LiveKit, Cloudflare R2 and
Bunny Stream. Nothing reads them yet — they are listed so the Vercel project is
configured once rather than at each phase. Phases 3–6 fill them in.
