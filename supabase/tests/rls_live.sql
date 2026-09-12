-- ---------------------------------------------------------------------------
-- Who may walk into a live class.
--
-- The live classroom replaces MeetPress, whose gate was a WooCommerce product
-- check in PHP and a room token in the URL. Here the gate is the same
-- `has_course_access()` that guards the lessons, enforced by policy — so these
-- assertions prove the thing that actually matters commercially: holding the
-- room link is worth nothing without having bought the course.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

create or replace function public.assert(ok boolean, what text)
returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice '  ok  %', what;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'buyer@test.fr',   '{"full_name":"Acheteur"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000002', 'stranger@test.fr','{"full_name":"Etranger"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000003', 'prof@test.fr',    '{"full_name":"Prof"}'::jsonb);
update public.profiles set role = 'instructor' where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.courses (id, slug, title, status, published_at) values
  ('c0000000-0000-4000-8000-000000000001', 'fiqh', 'Fiqh', 'published', now());

-- The buyer holds the course; the stranger holds nothing.
insert into public.entitlements (user_id, scope, course_id, delivery, expires_at)
values ('a0000000-0000-4000-8000-000000000001', 'course',
        'c0000000-0000-4000-8000-000000000001', 'online', now() + interval '365 days');

insert into public.live_sessions (id, course_id, title, status, scheduled_at)
values ('11110000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
        'Cours en direct — Fiqh', 'live', now());

\echo ''
\echo '=== live classroom access ==='

do $$
declare made uuid;
begin
  raise notice 'staff can actually schedule a class';

  -- Regression: the table once granted `authenticated` only SELECT, so this
  -- INSERT died on the grant before `live_sessions_write_staff` was ever
  -- consulted, and the admin screen could not create anything. The fixture rows
  -- above are inserted as superuser, which is exactly why that went unnoticed —
  -- so this asserts through a real staff session.
  call auth.login_as('a0000000-0000-4000-8000-000000000003');
  insert into public.live_sessions (course_id, title)
  values ('c0000000-0000-4000-8000-000000000001', 'Séance créée par le prof')
  returning id into made;
  perform public.assert(made is not null, 'a member of staff can schedule a live class');

  update public.live_sessions set status = 'live' where id = made;
  perform public.assert(
    (select status from public.live_sessions where id = made) = 'live',
    'and open it');

  delete from public.live_sessions where id = made;
  reset role;
end $$;

do $$
declare refused boolean := false;
begin
  raise notice 'a student still cannot invent a class';

  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  begin
    insert into public.live_sessions (course_id, title)
    values ('c0000000-0000-4000-8000-000000000001', 'Cours pirate');
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  perform public.assert(refused,
    'widening the grant did not let a student create one — the policy still refuses');
end $$;

do $$
declare n integer;
begin
  raise notice 'the paywall decides the door';

  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  select count(*) into n from public.live_sessions;
  perform public.assert(n = 1, 'a student who bought the course sees the live class');
  perform public.assert(public.can_join_live('11110000-0000-4000-8000-000000000001'),
    'and may join it');
  reset role;

  call auth.login_as('a0000000-0000-4000-8000-000000000002');
  select count(*) into n from public.live_sessions;
  perform public.assert(n = 0, 'a stranger cannot even see that the class exists');
  perform public.assert(not public.can_join_live('11110000-0000-4000-8000-000000000001'),
    'and knowing the room id gets them nowhere — the token is an address, not a key');
  reset role;

  call auth.login_as('a0000000-0000-4000-8000-000000000003');
  select count(*) into n from public.live_sessions;
  perform public.assert(n = 1, 'staff see the class without buying it');
  reset role;
end $$;

do $$
declare refused boolean := false; n integer;
begin
  raise notice 'a stranger cannot knock, join, or invent attendance';

  call auth.login_as('a0000000-0000-4000-8000-000000000002');

  begin
    insert into public.live_join_requests (session_id, user_id, display_name)
    values ('11110000-0000-4000-8000-000000000001',
            'a0000000-0000-4000-8000-000000000002', 'Etranger');
  exception when insufficient_privilege then refused := true;
  end;
  perform public.assert(refused, 'the waiting room refuses someone with no entitlement');

  refused := false;
  begin
    perform public.live_join('11110000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then refused := true;
  end;
  perform public.assert(refused, 'and live_join refuses them outright');

  select count(*) into n from public.live_participants;
  perform public.assert(n = 0, 'no attendance row was created for them');
  reset role;
end $$;

do $$
declare refused boolean := false;
begin
  raise notice 'a student cannot promote themselves past the door';

  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  insert into public.live_join_requests (session_id, user_id, display_name)
  values ('11110000-0000-4000-8000-000000000001',
          'a0000000-0000-4000-8000-000000000001', 'Acheteur');

  -- Stronger than a policy that matches no rows: `authenticated` carries no
  -- UPDATE grant on this table at all, so the statement is refused before any
  -- policy is consulted. Self-approval is not a race to lose — it is not
  -- expressible.
  refused := false;
  begin
    update public.live_join_requests set status = 'approved'
     where user_id = 'a0000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then refused := true;
  end;
  perform public.assert(refused,
    'a student cannot admit themselves — the grant refuses the write outright');
  perform public.assert(
    (select status from public.live_join_requests
      where user_id = 'a0000000-0000-4000-8000-000000000001') = 'pending',
    'and the request is still pending the host''s decision');

  begin
    perform public.live_decide_join(
      (select id from public.live_join_requests
        where user_id = 'a0000000-0000-4000-8000-000000000001'), true);
  exception when insufficient_privilege then refused := true;
  end;
  perform public.assert(refused, 'nor can they call the host''s decision function');
  reset role;
end $$;

do $$
begin
  raise notice 'the host admits, and attendance is idempotent';

  call auth.login_as('a0000000-0000-4000-8000-000000000003');
  perform public.assert(
    public.live_decide_join(
      (select id from public.live_join_requests
        where user_id = 'a0000000-0000-4000-8000-000000000001'), true),
    'the host admits the student');
  reset role;

  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  perform public.assert(public.live_join('11110000-0000-4000-8000-000000000001') is not null,
    'the student joins');
  perform public.assert(
    public.live_join('11110000-0000-4000-8000-000000000001') is not null,
    'a dropped connection rejoining does not open a second attendance row');
  perform public.assert(
    (select count(*) from public.live_participants
      where session_id = '11110000-0000-4000-8000-000000000001') = 1,
    'exactly one attendance row stands');
  perform public.assert(public.live_leave('11110000-0000-4000-8000-000000000001'),
    'leaving closes it');
  perform public.assert(not public.live_leave('11110000-0000-4000-8000-000000000001'),
    'and leaving twice is a no-op rather than an error');
  reset role;
end $$;

do $$
begin
  raise notice 'an expired entitlement closes the door on the clock';

  -- `entitlements_period` insists the window stays coherent, so winding the
  -- expiry back means winding the start back with it.
  update public.entitlements
     set starts_at = now() - interval '400 days',
         expires_at = now() - interval '1 day'
   where user_id = 'a0000000-0000-4000-8000-000000000001';

  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  perform public.assert(not public.can_join_live('11110000-0000-4000-8000-000000000001'),
    'last year''s student cannot walk into this year''s class');
  perform public.assert((select count(*) from public.live_sessions) = 0,
    'and the class disappears from their listing');
  reset role;
end $$;

do $$
begin
  raise notice 'an ended class is not a back door';

  update public.entitlements
     set starts_at = now() - interval '1 day',
         expires_at = now() + interval '30 days'
   where user_id = 'a0000000-0000-4000-8000-000000000001';
  update public.live_sessions set status = 'ended'
   where id = '11110000-0000-4000-8000-000000000001';

  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  perform public.assert(not public.can_join_live('11110000-0000-4000-8000-000000000001'),
    'a finished class cannot be re-entered, entitlement or not');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Slides
--
-- The deck is metadata in Postgres and bytes in R2. These assertions cover the
-- part Postgres is responsible for: that a row can only ever name an object
-- filed under its own class, that only staff can build a deck, and that the
-- signed-download check refuses a key belonging to a class the asker cannot
-- enter. The bucket never sees an unsigned request, so if this holds, holding
-- an object key is worth as little as holding a room link.
-- ---------------------------------------------------------------------------

-- A second course and class, which the buyer does NOT hold. This is the
-- cross-class target every attempt below aims at.
insert into public.courses (id, slug, title, status, published_at) values
  ('c0000000-0000-4000-8000-000000000002', 'hadith', 'Hadith', 'published', now());
insert into public.live_sessions (id, course_id, title, status) values
  ('11110000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
   'Cours en direct — Hadith', 'live');

-- Re-open the Fiqh class the previous block ended, so these run against a live
-- room rather than a closed one.
update public.live_sessions set status = 'live'
 where id = '11110000-0000-4000-8000-000000000001';

do $$
declare refused boolean;
begin
  raise notice 'building a deck';

  call auth.login_as('a0000000-0000-4000-8000-000000000003');
  insert into public.live_slides (session_id, storage_key, filename, mime_type, byte_size, display_order)
  values ('11110000-0000-4000-8000-000000000001',
          'live/11110000-0000-4000-8000-000000000001/abcd1234efgh.png',
          'plan-du-cours.png', 'image/png', 120000, 0);
  perform public.assert(
    (select count(*) from public.live_slides
      where session_id = '11110000-0000-4000-8000-000000000001') = 1,
    'staff can add a slide to their class');

  -- The CHECK pins the key prefix to the row's own session, so even a bug in
  -- the action cannot file a slide under another class.
  refused := false;
  begin
    insert into public.live_slides (session_id, storage_key, mime_type, byte_size)
    values ('11110000-0000-4000-8000-000000000001',
            'live/11110000-0000-4000-8000-000000000002/stolen12.png', 'image/png', 1000);
  exception when check_violation then refused := true;
  end;
  perform public.assert(refused, 'a slide cannot name an object belonging to another class');

  refused := false;
  begin
    insert into public.live_slides (session_id, storage_key, mime_type, byte_size)
    values ('11110000-0000-4000-8000-000000000001',
            'live/11110000-0000-4000-8000-000000000001/../../secret.png', 'image/png', 1000);
  exception when check_violation then refused := true;
  end;
  perform public.assert(refused, 'and it cannot walk out of the prefix with ..');

  refused := false;
  begin
    insert into public.live_slides (session_id, storage_key, mime_type, byte_size)
    values ('11110000-0000-4000-8000-000000000001',
            'live/11110000-0000-4000-8000-000000000001/payload12.html', 'text/html', 1000);
  exception when check_violation then refused := true;
  end;
  perform public.assert(refused, 'nor be something a browser would execute');
  reset role;
end $$;

do $$
declare refused boolean := false;
begin
  raise notice 'who may read the deck';

  -- The buyer holds Fiqh, so the Fiqh deck is theirs to see.
  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  perform public.assert(
    (select count(*) from public.live_slides
      where session_id = '11110000-0000-4000-8000-000000000001') = 1,
    'a student who bought the course sees its slides');
  perform public.assert(
    public.can_read_slide('live/11110000-0000-4000-8000-000000000001/abcd1234efgh.png'),
    'and a download can be signed for them');

  -- A student may not build a deck, whatever the grant says.
  begin
    insert into public.live_slides (session_id, storage_key, mime_type, byte_size)
    values ('11110000-0000-4000-8000-000000000001',
            'live/11110000-0000-4000-8000-000000000001/mine1234.png', 'image/png', 1000);
  exception when insufficient_privilege then refused := true;
  end;
  perform public.assert(refused, 'a student cannot add a slide');

  perform public.assert(
    (select count(*) from public.live_slides
      where session_id = '11110000-0000-4000-8000-000000000001') = 1,
    'and nothing was written');
  reset role;

  -- The stranger holds neither course.
  call auth.login_as('a0000000-0000-4000-8000-000000000002');
  perform public.assert(
    (select count(*) from public.live_slides) = 0,
    'someone who bought nothing sees no slides at all');
  perform public.assert(
    not public.can_read_slide('live/11110000-0000-4000-8000-000000000001/abcd1234efgh.png'),
    'and no download can be signed for them, key in hand or not');
  reset role;
end $$;

do $$
begin
  raise notice 'the deck follows the class it belongs to';

  -- The buyer holds Fiqh, not Hadith: the second class is a different paywall.
  call auth.login_as('a0000000-0000-4000-8000-000000000003');
  insert into public.live_slides (session_id, storage_key, mime_type, byte_size)
  values ('11110000-0000-4000-8000-000000000002',
          'live/11110000-0000-4000-8000-000000000002/hadith01.png', 'image/png', 2000);
  reset role;

  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  perform public.assert(
    not public.can_read_slide('live/11110000-0000-4000-8000-000000000002/hadith01.png'),
    'holding one course does not open another course’s deck');
  perform public.assert(
    (select count(*) from public.live_slides) = 1,
    'and the other class’s slides are not even visible');
  reset role;

  -- Once the class is over the deck closes with it, the same as the room.
  update public.live_sessions set status = 'ended'
   where id = '11110000-0000-4000-8000-000000000001';
  call auth.login_as('a0000000-0000-4000-8000-000000000001');
  perform public.assert(
    not public.can_read_slide('live/11110000-0000-4000-8000-000000000001/abcd1234efgh.png'),
    'and an ended class stops signing downloads');
  reset role;
end $$;

drop function public.assert(boolean, text);

\echo ''
\echo 'ALL LIVE CLASSROOM TESTS PASSED'
\echo ''
