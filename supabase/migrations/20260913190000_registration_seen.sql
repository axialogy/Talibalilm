-- ---------------------------------------------------------------------------
-- A new registration is a notification, not a gate
--
-- The previous migration made a new account PENDING: it could sign in and
-- browse, but `is_approved()` refused the checkout until an admin let it in.
-- The school does not want that. It wants to KNOW somebody has registered —
-- an e-mail to the office and a badge in the admin sidebar — and a button to
-- say "seen", which clears the badge and changes nothing for the student.
--
-- So the gate comes out. Nothing here decides who may buy; RLS decides who may
-- read a lesson, as it always did, and an account that has not paid reads
-- nothing whether or not anybody has looked at it.
--
-- The column survives with a different meaning, so it is RENAMED. Leaving a
-- flag called `approved_at` that no longer approves anything is how a schema
-- starts lying to the next person reading it.
--
-- This file has to work whether or not 20260913180000 was ever applied — it
-- may be in production, or it may only exist in the repository — so every step
-- below asks the database what is actually there rather than assuming.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public'
               and table_name = 'profiles'
               and column_name = 'approved_at') then
    -- The approval gate ran. Carry its dates over verbatim: an account it
    -- back-filled stays "seen", and one that was genuinely waiting stays
    -- "new" — which is exactly what the office should still be shown.
    update public.profiles set reviewed_at = coalesce(reviewed_at, approved_at);
    alter table public.profiles drop column approved_at;
  else
    -- It never ran. Everyone who exists today counts as already seen, so the
    -- badge starts at zero instead of announcing the whole back catalogue.
    update public.profiles set reviewed_at = coalesce(reviewed_at, created_at);
  end if;
end $$;

comment on column public.profiles.reviewed_at is
  'When the office marked this registration as seen. Null means new — it clears a badge and grants nothing.';

-- Usually already gone: it was a PARTIAL index whose WHERE clause named
-- `approved_at`, so dropping that column dropped it too. The notice Postgres
-- prints here is expected, not a fault — this line is for the case where the
-- column was dropped some other way.
drop index if exists public.profiles_pending_idx;

-- Unseen registrations, newest first — the badge and the list read this.
create index if not exists profiles_unreviewed_idx
  on public.profiles (created_at desc)
  where reviewed_at is null;

-- The gate itself, gone. `is_approved` was never referenced by a policy — it
-- was called from the checkout action — so dropping it removes a check rather
-- than opening a hole.
drop function if exists public.is_approved(uuid);
drop function if exists public.admin_set_approval(uuid, boolean);
drop function if exists public.pending_student_count();

-- ---------------------------------------------------------------------------
-- Mark a registration as seen
--
-- A definer function rather than an UPDATE through a policy, for the reason
-- that applies to every other admin write here: `record_admin_action` is
-- revoked from every session role and callable only from inside another
-- definer function, so doing the write here is what makes "who cleared this
-- notification, and when" answerable at all.
--
-- Returns whether anything actually changed. The `where reviewed_at is null`
-- is what makes it idempotent, and it is the DATABASE deciding that, not a
-- caller remembering — a second press writes no second audit row, so the
-- office cannot inflate its own log by clicking twice.
-- ---------------------------------------------------------------------------
create or replace function public.admin_mark_reviewed(uid uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  changed integer;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
  set reviewed_at = now(), updated_at = now()
  where id = uid and reviewed_at is null;

  get diagnostics changed = row_count;
  if changed = 0 then
    return false;
  end if;

  perform public.record_admin_action(
    'student.reviewed', 'user', uid::text, '', '{}'::jsonb);

  return true;
end;
$$;

revoke all on function public.admin_mark_reviewed(uuid) from public;
grant execute on function public.admin_mark_reviewed(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- How many have not been looked at
--
-- `profiles` is readable by staff, so the office could count this itself — but
-- the badge is drawn on every admin page, and a definer count is one partial
-- index scan rather than a policy-filtered read of the whole table.
-- ---------------------------------------------------------------------------
create or replace function public.unreviewed_student_count()
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case when public.is_staff() then
    (select count(*)::integer from public.profiles
      where role = 'student' and reviewed_at is null)
  else 0 end;
$$;

revoke all on function public.unreviewed_student_count() from public;
grant execute on function public.unreviewed_student_count() to authenticated, service_role;
