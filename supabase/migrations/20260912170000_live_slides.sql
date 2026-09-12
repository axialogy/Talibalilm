-- ---------------------------------------------------------------------------
-- Slides for a live class
--
-- The file itself is NOT here. Postgres holds the metadata and the object key;
-- the bytes live in Cloudflare R2, reached only through a short-lived signed
-- URL minted server-side. Storing a presentation in a database column would
-- make every read of the deck a large query, and would put binary the RLS
-- policies cannot meaningfully inspect inside the same rows that decide access.
--
-- Who may see a deck is not a new question. A slide belongs to a live session,
-- a session belongs to a course, and the course is what somebody paid for — so
-- the policy defers to `can_join_live()`, the same function the classroom page
-- and the attendance log already use. There is no second rule to drift.
-- ---------------------------------------------------------------------------

create table public.live_slides (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.live_sessions (id) on delete cascade,
  -- The object's name inside the bucket. Unique so two rows can never claim the
  -- same bytes, and shaped by the check below so a row can only ever point at
  -- an object filed under its own session.
  storage_key  text not null unique,
  filename     text not null default '',
  mime_type    text not null,
  byte_size    integer not null,
  display_order integer not null default 0,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),

  -- The key is built server-side as `live/<session id>/<random>.<ext>`. Pinning
  -- the prefix to this row's own session in a CHECK means that even a bug in
  -- the action cannot file a slide under another class, and cannot walk out of
  -- the prefix with `..` — the pattern admits neither.
  constraint live_slides_key_owned
    check (storage_key ~ ('^live/' || session_id::text || '/[A-Za-z0-9_-]{8,64}\.(png|jpg|webp)$')),
  -- Only what the byte sniffer can recognise. A deck is images; anything that a
  -- browser might execute has no business being served back to a class.
  constraint live_slides_mime_allowed
    check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  constraint live_slides_size_sane check (byte_size > 0 and byte_size <= 5 * 1024 * 1024),
  constraint live_slides_order_sane check (display_order between 0 and 9999)
);

create index live_slides_deck_idx on public.live_slides (session_id, display_order, created_at);

-- ---------------------------------------------------------------------------
-- RLS — the class roster decides, exactly as it does for the room
-- ---------------------------------------------------------------------------

alter table public.live_slides enable row level security;
alter table public.live_slides force row level security;

revoke all on public.live_slides from anon, authenticated;
grant select on public.live_slides to authenticated;
grant insert, update, delete on public.live_slides to authenticated;

-- A student sees a deck only for a class they could actually walk into. Note
-- this is the same predicate as the room itself: no entitlement, no slides,
-- whatever URL or object key they were handed.
create policy live_slides_select_entitled on public.live_slides for select
  to authenticated
  using (public.can_join_live(session_id));

create policy live_slides_select_staff on public.live_slides for select
  to authenticated using (public.is_staff());

-- Only staff build a deck. A student holds no insert, update or delete path at
-- all: there is no policy for them here, so the grant above is inert for them.
create policy live_slides_write_staff on public.live_slides for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- May this user read this object?
--
-- Asked by the action that mints a signed download URL, and answered from the
-- key alone, so the caller cannot pass a session id that disagrees with the
-- object it wants. Security definer because a student cannot read
-- `live_sessions` rows for courses they do not hold — which is the point.
-- ---------------------------------------------------------------------------

create or replace function public.can_read_slide(key text, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.live_slides s
    where s.storage_key = key
      and (public.is_staff(uid) or public.can_join_live(s.session_id, uid))
  );
$$;

revoke all on function public.can_read_slide(text, uuid) from public;
grant execute on function public.can_read_slide(text, uuid) to authenticated, service_role;
