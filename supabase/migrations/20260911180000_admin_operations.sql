-- ---------------------------------------------------------------------------
-- What the office actually needs to run the school.
--
-- Until now the admin panel could edit the catalogue but could not answer the
-- questions a paying customer generates: did my payment go through, give me a
-- cash code, open access for a scholarship, why did my access stop. This adds
-- the privileged operations behind those, and the trail that makes them
-- defensible.
--
-- Every function here is SECURITY DEFINER and gated on `is_admin()` (or
-- `is_staff()` for reads) INSIDE the function, and is called through the
-- ordinary authenticated client — never the service role. That is deliberate:
-- run as the admin's own session, `auth.uid()` is the real person, so the
-- audit row names who did it rather than "the service role". A stolen anon key
-- gains nothing, because the is_admin() check fails for a student.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The trail (audit finding A4, brought forward because a manual grant without
-- a recorded reason is worse than no manual grant at all).
-- ---------------------------------------------------------------------------

create table public.admin_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  target_type text not null default '',
  target_id   text not null default '',
  reason      text not null default '',
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),

  constraint admin_audit_action_shape check (action <> '')
);

create index admin_audit_created_idx on public.admin_audit (created_at desc);
create index admin_audit_target_idx on public.admin_audit (target_type, target_id);

alter table public.admin_audit enable row level security;
alter table public.admin_audit force row level security;

-- Readable by admins, writable by no client at all. The functions below write
-- it as the definer; a direct insert from a session must be impossible, or the
-- trail could be forged by whoever it is meant to hold accountable.
revoke all on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;

create policy admin_audit_select_admin on public.admin_audit for select
  to authenticated using (public.is_admin());

/** Append one row to the trail. Internal — only the functions below call it. */
create or replace function public.record_admin_action(
  action text, target_type text, target_id text, reason text, detail jsonb
) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.admin_audit (actor_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), action, target_type, target_id, reason, detail);
$$;

revoke all on function public.record_admin_action(text, text, text, text, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Reading who is who
--
-- `profiles` has no email — it lives in `auth.users`, which no client may
-- read. The orders and students screens are useless without it, so this hands
-- staff exactly id -> email for the ids they ask about, and nothing else.
-- ---------------------------------------------------------------------------

create or replace function public.emails_for(ids uuid[])
returns table (id uuid, email text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_staff() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;
  return query
    select u.id, u.email::text from auth.users u where u.id = any(ids);
end;
$$;

revoke all on function public.emails_for(uuid[]) from public;
grant execute on function public.emails_for(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Granting access by hand
--
-- A scholarship, a teacher, a make-good after a support call. Same stacking
-- rule as a paid order — extend the live row rather than inserting a second —
-- so a manual grant on top of a purchase does the sane thing. A reason is
-- required, and recorded.
-- ---------------------------------------------------------------------------

create or replace function public.admin_grant_entitlement(
  target_user uuid,
  target_scope public.entitlement_scope,
  course_id uuid,
  cursus_id uuid,
  year_index integer,
  delivery public.delivery_mode,
  days integer,
  reason text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  ent_id uuid;
  touched integer;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;
  if reason is null or btrim(reason) = '' then
    raise exception 'a reason is required for a manual grant' using errcode = 'check_violation';
  end if;
  if days < 1 or days > 3650 then
    raise exception 'days out of range' using errcode = 'check_violation';
  end if;

  if target_scope = 'course' then
    update public.entitlements
       set expires_at = greatest(expires_at, now()) + make_interval(days => days),
           granted_by = actor,
           note = left(reason, 500)
     where user_id = target_user and status = 'active' and scope = 'course'
       and entitlements.course_id = admin_grant_entitlement.course_id
       and entitlements.delivery = admin_grant_entitlement.delivery
    returning id into ent_id;
    get diagnostics touched = row_count;
    if touched = 0 then
      insert into public.entitlements
        (user_id, scope, course_id, delivery, expires_at, granted_by, note)
      values (target_user, 'course', admin_grant_entitlement.course_id,
              admin_grant_entitlement.delivery,
              now() + make_interval(days => days), actor, left(reason, 500))
      returning id into ent_id;
    end if;
  elsif target_scope = 'cursus' then
    update public.entitlements
       set expires_at = greatest(expires_at, now()) + make_interval(days => days),
           granted_by = actor, note = left(reason, 500)
     where user_id = target_user and status = 'active' and scope = 'cursus'
       and entitlements.cursus_id = admin_grant_entitlement.cursus_id
       and entitlements.year_index = admin_grant_entitlement.year_index
       and entitlements.delivery = admin_grant_entitlement.delivery
    returning id into ent_id;
    get diagnostics touched = row_count;
    if touched = 0 then
      insert into public.entitlements
        (user_id, scope, cursus_id, year_index, delivery, expires_at, granted_by, note)
      values (target_user, 'cursus', admin_grant_entitlement.cursus_id,
              admin_grant_entitlement.year_index, admin_grant_entitlement.delivery,
              now() + make_interval(days => days), actor, left(reason, 500))
      returning id into ent_id;
    end if;
  else
    update public.entitlements
       set expires_at = greatest(expires_at, now()) + make_interval(days => days),
           granted_by = actor, note = left(reason, 500)
     where user_id = target_user and status = 'active' and scope = 'site'
    returning id into ent_id;
    get diagnostics touched = row_count;
    if touched = 0 then
      insert into public.entitlements
        (user_id, scope, expires_at, granted_by, note)
      values (target_user, 'site', now() + make_interval(days => days), actor, left(reason, 500))
      returning id into ent_id;
    end if;
  end if;

  perform public.record_admin_action(
    'entitlement.grant', 'entitlement', ent_id::text, reason,
    jsonb_build_object('user_id', target_user, 'scope', target_scope, 'days', days));
  return ent_id;
end;
$$;

revoke all on function public.admin_grant_entitlement(uuid, public.entitlement_scope, uuid, uuid, integer, public.delivery_mode, integer, text) from public;
grant execute on function public.admin_grant_entitlement(uuid, public.entitlement_scope, uuid, uuid, integer, public.delivery_mode, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Taking access back by hand
--
-- Distinct from a refund: this does not touch the order or the money, only the
-- access. Ends the row now rather than deleting it, so `has_course_access`
-- stops honouring it on the clock and the history survives.
-- ---------------------------------------------------------------------------

create or replace function public.admin_revoke_entitlement(entitlement_id uuid, reason text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;
  if reason is null or btrim(reason) = '' then
    raise exception 'a reason is required to revoke access' using errcode = 'check_violation';
  end if;

  update public.entitlements
     set status = 'cancelled',
         expires_at = least(expires_at, now()),
         starts_at = least(starts_at, now() - interval '1 second'),
         note = left(reason, 500)
   where id = entitlement_id and status = 'active'
  returning user_id into uid;

  if uid is null then return false; end if;

  perform public.record_admin_action(
    'entitlement.revoke', 'entitlement', entitlement_id::text, reason,
    jsonb_build_object('user_id', uid));
  return true;
end;
$$;

revoke all on function public.admin_revoke_entitlement(uuid, text) from public;
grant execute on function public.admin_revoke_entitlement(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Cash codes for the front desk
--
-- Generate a batch of single-use 100%-off codes to hand out over the counter.
-- Each is a real coupon, so redeeming one produces exactly the same order and
-- entitlement rows as a card payment — the office route the checkout already
-- knows. Returned once, here, because a secret is worth nothing after it is
-- stored where it can be read back.
-- ---------------------------------------------------------------------------

create or replace function public.admin_generate_coupons(
  quantity integer,
  percent_off integer,
  amount_off_cents integer,
  max_redemptions integer,
  is_office boolean,
  batch text,
  code_prefix text,
  expires_at timestamptz
) returns setof text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  made integer := 0;
  attempts integer := 0;
  new_code text;
  prefix text := coalesce(upper(regexp_replace(code_prefix, '[^A-Za-z0-9-]', '', 'g')), '');
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;
  if quantity < 1 or quantity > 500 then
    raise exception 'quantity must be between 1 and 500' using errcode = 'check_violation';
  end if;
  if (percent_off is not null) = (amount_off_cents is not null) then
    raise exception 'give exactly one of percent_off or amount_off_cents'
      using errcode = 'check_violation';
  end if;

  while made < quantity loop
    attempts := attempts + 1;
    if attempts > quantity * 20 then
      raise exception 'could not generate enough unique codes' using errcode = 'internal_error';
    end if;
    -- prefix + 8 random base32-ish chars, upper-case, within the 6..32 shape.
    new_code := left(
      nullif(prefix, '') || case when prefix <> '' then '-' else '' end ||
      upper(translate(encode(gen_random_bytes(6), 'base64'), '+/=', 'XYZ')),
      32);
    new_code := regexp_replace(new_code, '[^A-Z0-9-]', '', 'g');
    if length(new_code) < 6 then continue; end if;

    begin
      insert into public.coupons
        (code, percent_off, amount_off_cents, max_redemptions, is_office, batch, created_by, expires_at)
      values (new_code, percent_off, amount_off_cents,
              coalesce(max_redemptions, 1), is_office, coalesce(batch, ''), actor, expires_at);
      made := made + 1;
      return next new_code;
    exception when unique_violation then
      -- Collision on the random suffix; try again.
      null;
    end;
  end loop;

  perform public.record_admin_action(
    'coupon.generate', 'batch', coalesce(batch, ''), '',
    jsonb_build_object('quantity', quantity, 'is_office', is_office,
                       'percent_off', percent_off, 'amount_off_cents', amount_off_cents));
  return;
end;
$$;

revoke all on function public.admin_generate_coupons(integer, integer, integer, integer, boolean, text, text, timestamptz) from public;
grant execute on function public.admin_generate_coupons(integer, integer, integer, integer, boolean, text, text, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Killing a code that got out
--
-- Does not delete it — a code already redeemed has orders pointing at it, and
-- the history matters. Caps redemptions at what has already been used, so it
-- can never be spent again while staying reconcilable.
-- ---------------------------------------------------------------------------

create or replace function public.admin_void_coupon(coupon_id uuid, reason text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare found_code text;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;

  update public.coupons
     set max_redemptions = redeemed_count,
         expires_at = least(coalesce(expires_at, now()), now())
   where id = coupon_id
  returning code into found_code;

  if found_code is null then return false; end if;

  perform public.record_admin_action(
    'coupon.void', 'coupon', coupon_id::text, coalesce(reason, ''),
    jsonb_build_object('code', found_code));
  return true;
end;
$$;

revoke all on function public.admin_void_coupon(uuid, text) from public;
grant execute on function public.admin_void_coupon(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Email idempotency
--
-- A webhook retry and the return route both settle the same order, so the
-- confirmation must be sent at most once. A timestamp claimed atomically is
-- the lock: the first writer to set it sends, everyone else sees it set.
-- ---------------------------------------------------------------------------

alter table public.orders add column confirmation_sent_at timestamptz;

/** Claim the right to send the confirmation for an order. True to exactly one caller. */
create or replace function public.claim_confirmation_email(oid uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare claimed uuid;
begin
  update public.orders
     set confirmation_sent_at = now()
   where id = oid and status = 'paid' and confirmation_sent_at is null
  returning id into claimed;
  return claimed is not null;
end;
$$;

revoke all on function public.claim_confirmation_email(uuid) from public;
grant execute on function public.claim_confirmation_email(uuid) to service_role;
