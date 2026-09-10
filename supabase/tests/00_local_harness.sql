-- ---------------------------------------------------------------------------
-- LOCAL TEST HARNESS — never applied to a Supabase project.
--
-- Supabase ships the `auth` schema, the `anon` / `authenticated` /
-- `service_role` roles and `auth.uid()`. A plain Postgres has none of them, so
-- this recreates just enough of that surface for the policy tests in this
-- directory to run against the real migrations.
--
-- It is deliberately NOT in supabase/migrations/: applying it to a real
-- project would collide with Supabase's own auth schema.
-- ---------------------------------------------------------------------------

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Supabase reads the subject out of the request's JWT claims. Tests set the
-- same GUC, so the policies under test see exactly what they see in production.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- Act as a given user for the statements that follow.
create or replace procedure auth.login_as(uid uuid)
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace procedure auth.logout()
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end;
$$;
