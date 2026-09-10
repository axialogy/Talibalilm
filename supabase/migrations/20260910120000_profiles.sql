-- ---------------------------------------------------------------------------
-- Profiles
--
-- One row per auth user, created by trigger at signup. Holds the application
-- role, which every later policy in this project will read.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create type public.user_role as enum ('student', 'instructor', 'admin');
create type public.app_locale as enum ('fr', 'ar');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null default '',
  phone       text,
  locale      public.app_locale not null default 'fr',
  role        public.user_role  not null default 'student',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint profiles_full_name_length check (char_length(full_name) <= 120),
  -- Loose on purpose: French landlines, mobiles and foreign numbers all have
  -- to fit. Shape is validated at the form boundary by Zod, not here.
  constraint profiles_phone_length check (phone is null or char_length(phone) between 6 and 32)
);

comment on table public.profiles is
  'Application-level user record. auth.users holds credentials; this holds who they are to the school.';
comment on column public.profiles.role is
  'Authorisation source of truth. Not user-writable — see the column grants below.';

create index profiles_role_idx on public.profiles (role) where role <> 'student';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Role lookup
--
-- security definer so a policy ON profiles can read profiles without
-- recursing into its own policy. `set search_path` is not optional here: a
-- definer function without it can be hijacked by a caller-controlled
-- search_path.
-- ---------------------------------------------------------------------------

create or replace function public.user_role(uid uuid default auth.uid())
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = uid;
$$;

revoke all on function public.user_role(uuid) from public;
grant execute on function public.user_role(uuid) to authenticated, service_role;

create or replace function public.is_staff(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.user_role(uid) in ('instructor', 'admin'), false);
$$;

revoke all on function public.is_staff(uuid) from public;
grant execute on function public.is_staff(uuid) to authenticated, service_role;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.user_role(uid) = 'admin', false);
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Provisioning
--
-- The row is created by trigger rather than by the client, so a profile can
-- never be missing and the client never gets to choose its own role.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    -- raw_user_meta_data is client-supplied, so anything but a known locale
    -- falls back to the default rather than failing the signup.
    case when new.raw_user_meta_data ->> 'locale' = 'ar' then 'ar'::public.app_locale
         else 'fr'::public.app_locale end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy profiles_select_staff
  on public.profiles for select
  to authenticated
  using (public.is_staff());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert or delete policy for `authenticated`: rows arrive by trigger and
-- leave by cascade from auth.users. Anything else is a bug.

-- ---------------------------------------------------------------------------
-- Column privileges — the part RLS cannot do
--
-- RLS is row-level. `profiles_update_own` would happily let a student set
-- their own role to 'admin', because the row still passes the check. Column
-- grants are the only mechanism that stops it, so `role` is simply not in the
-- set of columns `authenticated` may write. Admins go through
-- `profiles_update_admin`, which the grants below still constrain — so role
-- changes are done with the service-role client from an audited admin action,
-- never from the browser.
-- ---------------------------------------------------------------------------

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, locale) on public.profiles to authenticated;
