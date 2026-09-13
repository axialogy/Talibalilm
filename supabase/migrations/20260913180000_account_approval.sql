-- ---------------------------------------------------------------------------
-- The school decides who joins it
--
-- Anyone could open an account and walk straight into the checkout. Nothing was
-- lost by that — RLS means an unpaid account reads nothing — but the school
-- wants to know who is registering and to let them in deliberately, which is a
-- different question from whether they have paid.
--
-- So: a profile is pending until an admin approves it. A pending student may
-- sign in and browse; what they may not do is open an order.
--
-- WHERE THIS IS ENFORCED, stated plainly because it is not the usual answer.
-- Every other gate in this schema is an RLS policy. This one cannot be: orders
-- are opened by `createPendingOrder` through the SERVICE ROLE, because opening
-- one has to claim a coupon and a pack seat atomically, and the service role
-- bypasses policies by definition. A policy on `orders` would therefore never
-- fire, and writing one would be decoration that reads like a gate.
--
-- Instead the checkout asks `is_approved()` — this function, in this database,
-- answering for `auth.uid()` — and refuses before any money is involved. The
-- app carries the refusal; the DATABASE carries the answer. A client cannot
-- claim to be approved.
--
-- Refusing before payment rather than at the grant is the deliberate choice:
-- the other order would take a student's money and then hand them nothing.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists approved_at timestamptz;

-- Everyone who already has an account keeps it. A gate added today must not
-- lock out the students who registered yesterday.
update public.profiles set approved_at = coalesce(approved_at, created_at);

comment on column public.profiles.approved_at is
  'When an admin let this account in. Null means pending; staff are never pending.';

-- Pending accounts, newest first — the admin queue reads this.
create index if not exists profiles_pending_idx
  on public.profiles (created_at desc)
  where approved_at is null;

-- ---------------------------------------------------------------------------
-- May this person buy?
--
-- Staff are never pending: the teacher's own account is not something the
-- teacher has to approve, and a promotion to instructor should not be able to
-- leave somebody in a queue. Everyone else needs a date in `approved_at`.
--
-- `security definer` so it answers the same whatever the caller can see of
-- `profiles`, and `stable` so it can be used in a policy later without
-- re-running per row.
-- ---------------------------------------------------------------------------
create or replace function public.is_approved(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and (p.role <> 'student' or p.approved_at is not null)
  );
$$;

revoke all on function public.is_approved(uuid) from public;
grant execute on function public.is_approved(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Let somebody in, or put them back in the queue
--
-- A definer function rather than an UPDATE through a policy, for one reason
-- worth having: `record_admin_action` is revoked from every session role and
-- callable only from inside another definer function. Doing the write here is
-- what makes "who approved this account, and when" answerable at all.
--
-- Returns the e-mail to write to, so the caller does not have to go back to
-- `auth.users` for it — and returns null when nothing changed, so a caller
-- cannot send a welcome message for an approval that did not happen.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_approval(uid uuid, approve boolean)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target_role public.user_role;
  already boolean;
  address text;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;

  select p.role, p.approved_at is not null into target_role, already
  from public.profiles p where p.id = uid;

  if target_role is null then
    return null;
  end if;
  if target_role <> 'student' then
    raise exception 'not a student account' using errcode = 'check_violation';
  end if;

  -- Idempotent, and it says so by returning null: approving an approved
  -- account is not an event, and must not send a second welcome message.
  if already = approve then
    return null;
  end if;

  update public.profiles
  set approved_at = case when approve then now() else null end,
      updated_at = now()
  where id = uid;

  perform public.record_admin_action(
    case when approve then 'student.approve' else 'student.unapprove' end,
    'user', uid::text, '',
    jsonb_build_object('approved', approve));

  select u.email into address from auth.users u where u.id = uid;
  return address;
end;
$$;

revoke all on function public.admin_set_approval(uuid, boolean) from public;
grant execute on function public.admin_set_approval(uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- How many are waiting
--
-- `profiles` is readable by staff, so the office could count this itself — but
-- the badge is drawn on every admin page, and a definer count is one cheap
-- index scan rather than a policy-filtered read of the whole table.
-- ---------------------------------------------------------------------------
create or replace function public.pending_student_count()
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case when public.is_staff() then
    (select count(*)::integer from public.profiles
      where role = 'student' and approved_at is null)
  else 0 end;
$$;

revoke all on function public.pending_student_count() from public;
grant execute on function public.pending_student_count() to authenticated, service_role;
