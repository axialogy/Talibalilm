-- ---------------------------------------------------------------------------
-- The office operations, and who is allowed to run them.
--
-- These back the Orders / Students / Coupons screens the audit called B7. The
-- point of every assertion is the same: a privileged action is gated on
-- is_admin() INSIDE a security-definer function, records the real actor, and
-- refuses a student even though the function bypasses RLS to do its work.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

create or replace function public.assert(ok boolean, what text)
returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice '  ok  %', what;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'student@test.fr', '{"full_name":"Étudiant"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000002', 'staff@test.fr',   '{"full_name":"Prof"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000003', 'admin@test.fr',   '{"full_name":"Direction"}'::jsonb);
update public.profiles set role = 'instructor' where id = 'a0000000-0000-4000-8000-000000000002';
update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.courses (id, slug, title, status, published_at) values
  ('c0000000-0000-4000-8000-000000000001', 'fiqh', 'Fiqh', 'published', now());

\echo ''
\echo '=== admin operations ==='

-- --- emails: staff yes, student no ----------------------------------------

do $$
declare refused boolean := false;
begin
  raise notice 'reading emails is a staff capability';

  call auth.login_as('a0000000-0000-4000-8000-000000000002');
  perform public.assert(
    (select email from public.emails_for(array['a0000000-0000-4000-8000-000000000001'::uuid]))
      = 'student@test.fr',
    'a staff member can resolve a user id to an email for the office screens');
  reset role;

  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  begin
    perform public.emails_for(array['a0000000-0000-4000-8000-000000000002'::uuid]);
  exception when insufficient_privilege then refused := true;
  end;
  perform public.assert(refused, 'a student cannot read anyone''s email');
  reset role;
end $$;

-- --- manual grant: admin only, reason required, audited --------------------

do $$
declare ent uuid; refused boolean := false;
begin
  raise notice 'granting access by hand';

  call auth.login_as('a0000000-0000-4000-8000-000000000002');
  begin
    perform public.admin_grant_entitlement(
      'a0000000-0000-4000-8000-000000000001', 'course',
      'c0000000-0000-4000-8000-000000000001', null, 1, 'online', 365, 'test');
  exception when insufficient_privilege then refused := true;
  end;
  perform public.assert(refused, 'an INSTRUCTOR cannot grant access — this is admin only');
  reset role;

  call auth.login_as('a0000000-0000-4000-8000-000000000003');
  refused := false;
  begin
    perform public.admin_grant_entitlement(
      'a0000000-0000-4000-8000-000000000001', 'course',
      'c0000000-0000-4000-8000-000000000001', null, 1, 'online', 365, '');
  exception when check_violation then refused := true;
  end;
  perform public.assert(refused, 'a grant with no reason is refused');

  ent := public.admin_grant_entitlement(
    'a0000000-0000-4000-8000-000000000001', 'course',
    'c0000000-0000-4000-8000-000000000001', null, 1, 'online', 365, 'scholarship 2026');
  perform public.assert(ent is not null, 'an admin can grant with a reason');
  perform public.assert(
    public.has_course_access('c0000000-0000-4000-8000-000000000001',
                             'a0000000-0000-4000-8000-000000000001'),
    'and the student can now read the course');
  perform public.assert(
    (select actor_id from public.admin_audit
      where action = 'entitlement.grant' order by created_at desc limit 1)
      = 'a0000000-0000-4000-8000-000000000003',
    'the trail names the admin who did it, not the service role');
  perform public.assert(
    (select reason from public.admin_audit
      where action = 'entitlement.grant' order by created_at desc limit 1) = 'scholarship 2026',
    'and records the reason they gave');
  reset role;
end $$;

do $$
declare ent uuid; before_expiry timestamptz; after_expiry timestamptz;
begin
  raise notice 'a second manual grant stacks rather than duplicating';

  call auth.login_as('a0000000-0000-4000-8000-000000000003');
  select expires_at into before_expiry from public.entitlements
   where user_id = 'a0000000-0000-4000-8000-000000000001' and scope = 'course';

  ent := public.admin_grant_entitlement(
    'a0000000-0000-4000-8000-000000000001', 'course',
    'c0000000-0000-4000-8000-000000000001', null, 1, 'online', 30, 'extra month');

  select expires_at into after_expiry from public.entitlements
   where user_id = 'a0000000-0000-4000-8000-000000000001' and scope = 'course';
  perform public.assert(after_expiry > before_expiry,
    'the existing entitlement is extended, not a second one created');
  perform public.assert(
    (select count(*) from public.entitlements
      where user_id = 'a0000000-0000-4000-8000-000000000001' and scope = 'course') = 1,
    'still one row for that course');
  reset role;
end $$;

-- --- manual revoke ---------------------------------------------------------

do $$
declare ent uuid;
begin
  raise notice 'revoking access by hand';
  call auth.login_as('a0000000-0000-4000-8000-000000000003');

  select id into ent from public.entitlements
   where user_id = 'a0000000-0000-4000-8000-000000000001' and scope = 'course';

  perform public.assert(public.admin_revoke_entitlement(ent, 'left the programme'),
    'an admin can revoke a live entitlement');
  perform public.assert(
    not public.has_course_access('c0000000-0000-4000-8000-000000000001',
                                 'a0000000-0000-4000-8000-000000000001'),
    'and the student loses access immediately');
  perform public.assert(
    (select action from public.admin_audit order by created_at desc limit 1) = 'entitlement.revoke',
    'the revoke is on the trail too');
  reset role;
end $$;

-- --- coupon generation -----------------------------------------------------

do $$
declare codes text[]; refused boolean := false;
begin
  raise notice 'generating cash codes';

  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  begin
    perform public.admin_generate_coupons(5, 100, null, 1, true, 'sept', 'CAISSE', null);
  exception when insufficient_privilege then refused := true;
  end;
  perform public.assert(refused, 'a student cannot mint coupons');
  reset role;

  call auth.login_as('a0000000-0000-4000-8000-000000000003');
  select array_agg(c) into codes
    from public.admin_generate_coupons(10, 100, null, 1, true, 'sept-2026', 'CAISSE', null) c;
  perform public.assert(array_length(codes, 1) = 10, 'ten codes generated');
  perform public.assert(
    (select count(distinct c) from unnest(codes) c) = 10, 'and all ten are distinct');
  perform public.assert(
    (select bool_and(c ~ '^[A-Z0-9-]{6,32}$') from unnest(codes) c),
    'each matches the coupon code shape the constraint enforces');
  perform public.assert(
    (select count(*) from public.coupons where batch = 'sept-2026') = 10,
    'and all ten are stored against the batch for reconciliation');
  reset role;
end $$;

-- --- voiding a coupon ------------------------------------------------------

do $$
declare cid uuid;
begin
  raise notice 'voiding a code that got out';
  call auth.login_as('a0000000-0000-4000-8000-000000000003');

  select id into cid from public.coupons where batch = 'sept-2026' limit 1;
  perform public.assert(public.admin_void_coupon(cid, 'leaked'),
    'an admin can void a code');
  reset role;

  -- The voided code can no longer be redeemed, through the same function the
  -- checkout uses.
  perform public.assert(
    public.redeem_coupon((select code from public.coupons where id = cid)) is null,
    'and it can never be spent again');
end $$;

-- --- the trail is readable by admins and by no one else --------------------

do $$
declare refused boolean := false;
begin
  raise notice 'the trail is admin-only';

  call auth.login_as('a0000000-0000-4000-8000-000000000003');
  perform public.assert((select count(*) from public.admin_audit) >= 4,
    'an admin can read the trail');
  reset role;

  call auth.login_as('a0000000-0000-4000-8000-000000000002');
  perform public.assert((select count(*) from public.admin_audit) = 0,
    'an instructor cannot — a manual grant is above their pay grade to review');
  reset role;

  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  begin
    insert into public.admin_audit (action) values ('forged');
    refused := false;
  exception when insufficient_privilege then refused := true;
  end;
  perform public.assert(refused,
    'and no client can write the trail directly — it cannot be forged by the person it holds accountable');
  reset role;
end $$;

-- --- email is sent at most once -------------------------------------------

do $$
declare oid uuid := '44440000-4000-4000-8000-000000000001';
begin
  raise notice 'the confirmation email claim is a lock';

  insert into public.orders
    (id, user_id, route, delivery, subtotal_cents, total_cents, status, paid_at)
  values (oid, 'a0000000-0000-4000-8000-000000000001', 'paypal', 'online',
          10000, 10000, 'paid', now());

  perform public.assert(public.claim_confirmation_email(oid),
    'the first caller wins the right to send');
  perform public.assert(not public.claim_confirmation_email(oid),
    'and a webhook retry racing the return route is refused — sent at most once');
end $$;

drop function public.assert(boolean, text);

\echo ''
\echo 'ALL ADMIN OPERATION TESTS PASSED'
\echo ''
