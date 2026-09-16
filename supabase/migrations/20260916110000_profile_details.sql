-- ---------------------------------------------------------------------------
-- The student's own details, asked once at checkout
--
-- A registration at the institute is a real enrolment: the office needs who
-- the student is, how to reach them and where they live — not just a name and
-- an email. Those fields live on `profiles`, so they are filled once and are
-- already there the next time; the checkout requires them before it will take
-- a payment.
--
-- `phone` is the mobile (it already existed and is what the admin screens
-- show); `phone_landline` is the optional landline. The rest are new.
--
-- The column grants are the part that matters. `profiles_update_own` lets a
-- student write their own row, but a column is only writable if `authenticated`
-- holds UPDATE on it — which is how `role` is kept out of reach. Every new
-- column has to be named in a grant or the checkout form cannot save it, and
-- naming it is a deliberate act, not a side effect of adding it.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists civility       text,
  add column if not exists first_name     text not null default '',
  add column if not exists last_name      text not null default '',
  add column if not exists phone_landline text,
  add column if not exists birth_date     date,
  add column if not exists address        text not null default '',
  add column if not exists postal_code    text not null default '',
  add column if not exists city           text not null default '',
  add column if not exists department     text not null default '';

alter table public.profiles
  add constraint profiles_civility_shape
    check (civility is null or civility in ('madame', 'monsieur')),
  add constraint profiles_first_name_length
    check (char_length(first_name) <= 60),
  add constraint profiles_last_name_length
    check (char_length(last_name) <= 60),
  add constraint profiles_landline_length
    check (phone_landline is null or char_length(phone_landline) between 6 and 32),
  -- No upper bound against "now": a CHECK must be immutable, and today's date
  -- is not. Shape and plausibility are validated at the form boundary.
  add constraint profiles_birth_date_sane
    check (birth_date is null or birth_date >= date '1900-01-01'),
  add constraint profiles_address_length
    check (char_length(address) <= 200),
  -- Loose enough for a French five-digit code and for the neighbours' formats;
  -- the form narrows it further.
  add constraint profiles_postal_code_shape
    check (postal_code = '' or postal_code ~ '^[0-9A-Za-z][0-9A-Za-z -]{2,15}$'),
  add constraint profiles_city_length
    check (char_length(city) <= 120),
  add constraint profiles_department_length
    check (char_length(department) <= 120);

comment on column public.profiles.civility is
  'Madame or monsieur, as printed on the enrolment. Null until the checkout asks.';
comment on column public.profiles.department is
  'The department the student enrols in. One today (Sciences Islamiques); a column so a second costs no migration.';

-- Additive: the original grant on (full_name, phone, locale) still stands.
grant update (civility, first_name, last_name, phone_landline, birth_date, address, postal_code, city, department)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Erasure has to reach the new fields too
--
-- `admin_anonymise_user` names every column it scrubs. A column added without
-- touching this function would survive a GDPR erasure — the one bug in this
-- area that is both silent and serious.
-- ---------------------------------------------------------------------------

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

  if public.is_staff(target_user) then
    raise exception 'staff accounts cannot be anonymised' using errcode = 'check_violation';
  end if;

  select true into existed from public.profiles where id = target_user;
  if existed is null then return false; end if;

  update public.entitlements
     set status = 'cancelled',
         expires_at = least(expires_at, now()),
         starts_at = least(starts_at, now() - interval '1 second'),
         note = 'account anonymised'
   where user_id = target_user and status = 'active';
  get diagnostics revoked = row_count;

  -- Every identifying column, not only the two the first version knew about.
  update public.profiles
     set full_name = '',
         phone = null,
         civility = null,
         first_name = '',
         last_name = '',
         phone_landline = null,
         birth_date = null,
         address = '',
         postal_code = '',
         city = '',
         department = '',
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
