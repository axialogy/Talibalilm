-- ---------------------------------------------------------------------------
-- Two guards on the one account that can move money
--
-- The PayPal credentials are already unreadable through a session: the table
-- grants `authenticated` nothing, and the admin screen only ever sees whether
-- a secret exists. What a stolen admin session COULD do is write new
-- credentials — its own PayPal account — and collect the school's payments.
--
-- Two things close that:
--
--   1. A PIN, per admin, hashed outside the database (scrypt in Node, so no
--      extension is needed), checked with a short-lived step-up. The
--      application enforces it on the page AND on the save action.
--   2. `savePaymentSettings` alerts every admin and offers a one-click "it was
--      not me", which clears the credentials and disables online payment
--      immediately — the money path is closed before anyone investigates.
--
-- Neither is a substitute for a strong password and MFA on the admin account;
-- they are the second lock on the door that has the safe behind it.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- A role is not something a session may change
--
-- `authenticated` holds no column grant on `profiles.role`, so a student
-- cannot promote themselves — that has been true and tested since the first
-- migration. This is the belt to that braces: even if a future grant were
-- added by mistake, only the roles that are supposed to (the service role and
-- the SQL editor's `postgres`) can write a role at all.
--
-- The audit trail for role changes is the SQL editor itself; there is no app
-- path that changes a role, by design.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
  then
    raise exception 'a role is changed by the service role, never by a session'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- The admin PIN
--
-- One row per admin who has set one. No policies and no grants: this table is
-- reached only through the service role, from the server actions that hash and
-- verify. A PIN is a second factor for one screen, not a credential the
-- browser ever holds.
-- ---------------------------------------------------------------------------
create table public.admin_security (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  pin_hash        text not null,
  pin_salt        text not null,
  -- Failures are counted here rather than in memory so the lockout survives a
  -- deploy — an attacker who can restart the counter by waiting for one does
  -- not have a rate limit at all.
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now(),

  constraint admin_security_hash_present check (btrim(pin_hash) <> '' and btrim(pin_salt) <> ''),
  constraint admin_security_attempts_sane check (failed_attempts >= 0)
);

alter table public.admin_security enable row level security;
-- Deliberately no policy and no grant: the service role is the only reader.

comment on table public.admin_security is
  'Per-admin PIN for the PayPal configuration step-up. Hashed in Node, never readable from a session.';
