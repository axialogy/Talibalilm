-- ---------------------------------------------------------------------------
-- Policy tests for the site content tables.
--
-- Three separate claims, and each one is a different way to get it wrong:
--
--   * A DRAFT event or review is not public. The homepage filters on status in
--     its query, and a filter in a query is a convenience, not a gate — take
--     the filter out and the database must still refuse.
--   * `contact_messages` is insert-only for a stranger. Anyone may write to the
--     school; nobody may read back what anyone else wrote, or the table becomes
--     a list of who has contacted the institute and what about.
--   * `site_settings` is readable by everyone and writable by nobody but staff.
--     It is a banner and a footer, so the read is deliberately open — the thing
--     worth asserting is that an ordinary student cannot edit the banner on
--     every page of the site.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

create or replace function public.assert(ok boolean, what text)
returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice '  ok  %', what;
end $$;

-- --- fixtures -------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'student@test.fr', '{"full_name":"Étudiante"}'::jsonb),
  ('a0000000-0000-0000-0000-000000000002', 'admin@test.fr',   '{"full_name":"Direction"}'::jsonb);

update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000002';

insert into public.events (id, title, status) values
  ('b0000000-0000-0000-0000-000000000001', 'Portes ouvertes', 'published'),
  ('b0000000-0000-0000-0000-000000000002', 'Brouillon',       'draft');

insert into public.reviews (id, author_name, quote, status) values
  ('c0000000-0000-0000-0000-000000000001', 'Fatima', 'Un enseignement clair et exigeant.', 'published'),
  ('c0000000-0000-0000-0000-000000000002', 'Anonyme', 'Pas encore relu par la direction.', 'draft');

insert into public.contact_messages (id, name, email, body) values
  ('d0000000-0000-0000-0000-000000000001', 'Visiteur', 'visiteur@test.fr',
   'Bonjour, quels sont les horaires ?');

\echo '=== site content policy tests ==='

do $$
begin
  raise notice 'a stranger reads the published content and nothing else';
  set local role anon;

  perform public.assert(
    (select count(*) from public.events) = 1,
    'anon sees the published event');
  perform public.assert(
    not exists (select 1 from public.events where status = 'draft'),
    'a DRAFT event is invisible — the status filter in the page is not the gate');

  perform public.assert(
    (select count(*) from public.reviews) = 1,
    'anon sees the published review');
  perform public.assert(
    not exists (select 1 from public.reviews where status = 'draft'),
    'a review the school has not approved yet is invisible');

  perform public.assert(
    (select count(*) from public.site_settings) = 1,
    'the banner and the footer links are public, as they must be');

  reset role;
end $$;

do $$
declare
  refused boolean;
begin
  raise notice 'a stranger may write to the school, and may not read the postbag';

  -- The read is refused by the GRANT, before any policy is consulted — there
  -- is no `select` on this table for `anon` at all. That is deliberately
  -- stronger than a policy returning no rows: a policy can be loosened by
  -- accident, and this cannot be reached to loosen.
  refused := false;
  begin
    set local role anon;
    perform count(*) from public.contact_messages;
  exception when insufficient_privilege then
    refused := true;
  end;
  reset role;
  perform public.assert(refused,
    'anon is refused the contact messages outright — no select grant, not merely no rows');

  set local role anon;
  insert into public.contact_messages (name, email, body)
  values ('Curieux', 'curieux@test.fr', 'Je voudrais m''inscrire au cursus.');
  reset role;
  perform public.assert(
    exists (select 1 from public.contact_messages where email = 'curieux@test.fr'),
    'anon CAN leave a message, and it really lands');

  -- Having written one, they still cannot read it back. This is what stops the
  -- form becoming a way to enumerate the school's enquiries.
  refused := false;
  begin
    set local role anon;
    perform count(*) from public.contact_messages;
  exception when insufficient_privilege then
    refused := true;
  end;
  reset role;
  perform public.assert(refused, 'and still cannot read it back afterwards');

  refused := false;
  begin
    set local role anon;
    update public.contact_messages set handled_at = now();
  exception when insufficient_privilege then
    refused := true;
  end;
  reset role;
  perform public.assert(refused, 'anon cannot mark anything as handled');
end $$;

do $$
declare
  changed integer;
begin
  raise notice 'an ordinary student is not staff';
  call auth.login_as('a0000000-0000-0000-0000-000000000001');

  perform public.assert(
    (select count(*) from public.events) = 1,
    'a signed-in student sees published events only');
  perform public.assert(
    (select count(*) from public.contact_messages) = 0,
    'a signed-in student cannot read the contact messages either');

  -- No error: the policy makes the row invisible, so the update matches
  -- nothing. That is the shape to assert — "it threw" would pass for the
  -- wrong reason the day the policy changes to a visible-but-refused one.
  update public.site_settings set announcement_text = 'Piraté';
  get diagnostics changed = row_count;
  perform public.assert(changed = 0, 'a student cannot rewrite the site-wide banner');

  update public.events set title = 'Piraté';
  get diagnostics changed = row_count;
  perform public.assert(changed = 0, 'nor edit an event');

  update public.reviews set quote = 'Piraté';
  get diagnostics changed = row_count;
  perform public.assert(changed = 0, 'nor put words in another student''s mouth');

  reset role;
end $$;

do $$
declare
  changed integer;
begin
  raise notice 'staff see the drafts and own the writes';
  call auth.login_as('a0000000-0000-0000-0000-000000000002');

  perform public.assert(
    (select count(*) from public.events) = 2,
    'staff see the draft event as well as the published one');
  perform public.assert(
    (select count(*) from public.reviews) = 2,
    'staff see the unapproved review');
  perform public.assert(
    (select count(*) from public.contact_messages) >= 1,
    'staff read the contact messages');

  update public.site_settings set announcement_text = 'Inscriptions ouvertes';
  get diagnostics changed = row_count;
  perform public.assert(changed = 1, 'staff edit the banner');

  update public.contact_messages set handled_at = now()
  where id = 'd0000000-0000-0000-0000-000000000001';
  get diagnostics changed = row_count;
  perform public.assert(changed = 1, 'staff mark a message as handled');

  reset role;
end $$;

do $$
declare
  refused boolean := false;
begin
  raise notice 'the single-row rule on site_settings is the database''s, not the app''s';
  call auth.login_as('a0000000-0000-0000-0000-000000000002');
  begin
    insert into public.site_settings (id) values (false);
  exception when check_violation or unique_violation then
    refused := true;
  end;
  perform public.assert(refused, 'a second settings row cannot be created');
  reset role;
end $$;



-- ---------------------------------------------------------------------------
-- Account approval
--
-- The gate the school asked for: a new account is pending until an admin lets
-- it in. What is asserted here is that the ANSWER lives in the database — a
-- client cannot claim to be approved — and that approving is idempotent, so a
-- second press cannot send a second welcome message.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000003', 'pending@test.fr', '{"full_name":"En attente"}'::jsonb);

-- `handle_new_user` approves nobody, so every fixture account above is pending
-- exactly as a real new registration is. The migration's back-fill cannot be
-- observed from here — it ran before any of these rows existed — so an already
-- admitted account is set up explicitly instead of pretended into existence.
update public.profiles set approved_at = now()
where id = 'a0000000-0000-0000-0000-000000000001';

do $$
begin
  raise notice 'approval — who may buy';

  perform public.assert(
    not public.is_approved('a0000000-0000-0000-0000-000000000003'),
    'a fresh student account is pending');
  perform public.assert(
    public.is_approved('a0000000-0000-0000-0000-000000000001'),
    'an account with a date in approved_at is let in');
  perform public.assert(
    public.is_approved('a0000000-0000-0000-0000-000000000002'),
    'staff are never pending — the teacher does not approve themselves');
end $$;

do $$
declare
  refused boolean := false;
begin
  raise notice 'approval — only an admin decides';
  call auth.login_as('a0000000-0000-0000-0000-000000000003');
  begin
    perform public.admin_set_approval('a0000000-0000-0000-0000-000000000003', true);
  exception when insufficient_privilege then
    refused := true;
  end;
  reset role;
  perform public.assert(refused, 'a student cannot approve themselves');
  perform public.assert(
    not public.is_approved('a0000000-0000-0000-0000-000000000003'),
    'and is still pending afterwards');
end $$;

do $$
declare
  address text;
begin
  raise notice 'approval — the admin lets them in, once';
  call auth.login_as('a0000000-0000-0000-0000-000000000002');

  address := public.admin_set_approval('a0000000-0000-0000-0000-000000000003', true);
  perform public.assert(address = 'pending@test.fr',
    'approving hands back the address to write to');
  perform public.assert(
    public.is_approved('a0000000-0000-0000-0000-000000000003'),
    'the account is now let in');

  -- The idempotence that stops a second welcome e-mail going out.
  address := public.admin_set_approval('a0000000-0000-0000-0000-000000000003', true);
  perform public.assert(address is null,
    'approving an approved account is not an event — no address, so no second e-mail');

  perform public.assert(
    exists (select 1 from public.admin_audit
            where action = 'student.approve'
              and target_id = 'a0000000-0000-0000-0000-000000000003'),
    'and who approved it is on the record');

  address := public.admin_set_approval('a0000000-0000-0000-0000-000000000003', false);
  perform public.assert(address = 'pending@test.fr', 'putting them back is an event too');
  perform public.assert(
    not public.is_approved('a0000000-0000-0000-0000-000000000003'),
    'and they are pending again');

  perform public.assert(public.pending_student_count() = 1,
    'the queue the office sees counts exactly the pending students');

  reset role;
end $$;

do $$
begin
  raise notice 'approval — the count is staff-only';
  call auth.login_as('a0000000-0000-0000-0000-000000000003');
  perform public.assert(public.pending_student_count() = 0,
    'a student cannot use the queue to count the school''s registrations');
  reset role;
end $$;
\echo 'ALL SITE CONTENT TESTS PASSED'
