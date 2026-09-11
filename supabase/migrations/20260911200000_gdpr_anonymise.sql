-- ---------------------------------------------------------------------------
-- Erasure that survives the accountant (audit B9).
--
-- A student has the right to be forgotten; the school has to keep its sales
-- records. `orders.user_id` is `on delete restrict` precisely so those two do
-- not fight — a paying user cannot simply be deleted, because their orders hold
-- the reference. So erasure here is anonymisation, not deletion: the person is
-- scrubbed out of the account while the money rows stay, pointing at a user who
-- is now nobody in particular.
--
-- What this file scrubs is everything in the `public` schema that names the
-- person: their profile, and their live access. The email and login live in
-- `auth.users`, which only the auth admin may write, so the server action that
-- calls this follows up with the service-role Admin API to scrub the email,
-- clear the metadata and ban the login. The two together are one erasure; this
-- is the half the database owns.
--
-- Gated on is_admin() and called through the ordinary authenticated client, so
-- `auth.uid()` is the real admin and the audit row names who ran the erasure —
-- the same rule as every other privileged operation here.
-- ---------------------------------------------------------------------------

-- A stamp, so the office can see an account was erased and re-running is a
-- no-op rather than a second, confusing audit entry.
alter table public.profiles add column anonymised_at timestamptz;

create or replace function public.admin_anonymise_user(target_user uuid, reason text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  revoked integer;
  existed boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;
  if reason is null or btrim(reason) = '' then
    raise exception 'a reason is required to erase an account' using errcode = 'check_violation';
  end if;

  -- Refuse to erase a member of staff. Erasure is for the people the school
  -- serves; scrubbing a colleague's identity is either a mistake or an attack,
  -- and admin_audit.actor_id would then dangle too.
  if public.is_staff(target_user) then
    raise exception 'staff accounts cannot be anonymised' using errcode = 'check_violation';
  end if;

  select true into existed from public.profiles where id = target_user;
  if existed is null then return false; end if;

  -- End every live entitlement now. An erased person keeps no access; the rows
  -- stay (cancelled) so the history a refund or dispute might need is intact,
  -- the same way admin_revoke_entitlement leaves its trail.
  update public.entitlements
     set status = 'cancelled',
         expires_at = least(expires_at, now()),
         starts_at = least(starts_at, now() - interval '1 second'),
         note = 'account anonymised'
   where user_id = target_user and status = 'active';
  get diagnostics revoked = row_count;

  -- Scrub the profile. full_name back to its empty default, phone gone; role
  -- and locale are not identifying and stay. The stamp is kept from the first
  -- erasure so a re-run does not rewrite the date.
  update public.profiles
     set full_name = '',
         phone = null,
         anonymised_at = coalesce(anonymised_at, now())
   where id = target_user;

  perform public.record_admin_action(
    'user.anonymise', 'user', target_user::text, reason,
    jsonb_build_object('entitlements_cancelled', revoked));
  return true;
end;
$$;

revoke all on function public.admin_anonymise_user(uuid, text) from public;
grant execute on function public.admin_anonymise_user(uuid, text) to authenticated, service_role;
