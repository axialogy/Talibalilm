-- ---------------------------------------------------------------------------
-- Live classes (the MeetPress replacement).
--
-- The school teaches live and wants no 40-minute cap and no seat licence, so
-- the classroom is ours. What must NOT be ours is the decision about who may
-- walk in: a live class is part of a course somebody paid for, so the gate is
-- the same `has_course_access()` that already guards the lessons. There is no
-- second paywall here to drift out of step with the first.
--
-- Note what is absent: no room password, no "unlisted link" secrecy. The room
-- token addresses the room, it does not authorise entry — a student who is not
-- entitled gets nothing from holding it, because every policy below re-checks
-- access on the live session's own course.
-- ---------------------------------------------------------------------------

create type public.live_status as enum ('scheduled', 'live', 'ended', 'cancelled');
create type public.live_role as enum ('host', 'participant');
create type public.join_state as enum ('pending', 'approved', 'rejected');

create table public.live_sessions (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.courses (id) on delete cascade,
  title            text not null,
  description      text not null default '',
  host_id          uuid references public.profiles (id) on delete set null,
  -- Addresses the room in a URL. Not a secret and not a credential: entry is
  -- decided by the policies below, never by knowing this value.
  room_token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  status           public.live_status not null default 'scheduled',
  scheduled_at     timestamptz,
  started_at       timestamptz,
  ended_at         timestamptz,
  -- A mesh tops out around a dozen; an SFU carries far more. The cap is data so
  -- the office can lower it per class without a deploy.
  max_participants integer not null default 50,
  -- Set once the office has uploaded the recording and pasted the link back on
  -- a lesson. Keeps "was this class recorded?" answerable from the session.
  recording_note   text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint live_sessions_title_present check (btrim(title) <> ''),
  constraint live_sessions_capacity_sane check (max_participants between 2 and 500),
  constraint live_sessions_ends_after_start
    check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index live_sessions_course_idx on public.live_sessions (course_id, scheduled_at desc);
create index live_sessions_live_idx on public.live_sessions (status) where status = 'live';

create trigger live_sessions_touch_updated_at
  before update on public.live_sessions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Who is in the room, and who is waiting at the door
-- ---------------------------------------------------------------------------

create table public.live_participants (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.live_role not null default 'participant',
  joined_at  timestamptz not null default now(),
  left_at    timestamptz
);

create index live_participants_session_idx on public.live_participants (session_id, joined_at desc);
-- One open attendance row per person per room; rejoining after a drop reuses it.
create unique index live_participants_open_key
  on public.live_participants (session_id, user_id) where left_at is null;

create table public.live_join_requests (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.live_sessions (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '',
  status       public.join_state not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_at   timestamptz,

  unique (session_id, user_id)
);

create index live_join_requests_pending_idx
  on public.live_join_requests (session_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS — the same gate as the lessons, not a new one
-- ---------------------------------------------------------------------------

alter table public.live_sessions enable row level security;
alter table public.live_sessions force row level security;
alter table public.live_participants enable row level security;
alter table public.live_participants force row level security;
alter table public.live_join_requests enable row level security;
alter table public.live_join_requests force row level security;

revoke all on public.live_sessions from anon, authenticated;
revoke all on public.live_participants from anon, authenticated;
revoke all on public.live_join_requests from anon, authenticated;

grant select on public.live_sessions to authenticated;
grant select on public.live_participants to authenticated;
grant select, insert on public.live_join_requests to authenticated;

-- A student sees a class only for a course they actually hold. This is the
-- paywall: no entitlement, no row, whatever URL they were sent.
create policy live_sessions_select_entitled on public.live_sessions for select
  to authenticated
  using (public.has_course_access(course_id));

create policy live_sessions_select_staff on public.live_sessions for select
  to authenticated using (public.is_staff());

-- Staff run the classes. Students never write this table.
create policy live_sessions_write_staff on public.live_sessions for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- Attendance is visible to the person it is about, and to staff.
create policy live_participants_select_own on public.live_participants for select
  to authenticated using (user_id = auth.uid() or public.is_staff());

-- A student may knock, for a class they are entitled to, as themselves. They
-- may not approve themselves: no update policy exists for `authenticated`, so
-- the decision is the host's through the security-definer function below.
create policy live_join_requests_insert_own on public.live_join_requests for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.live_sessions s
      where s.id = session_id and public.has_course_access(s.course_id)
    )
  );

create policy live_join_requests_select_own on public.live_join_requests for select
  to authenticated using (user_id = auth.uid() or public.is_staff());

create policy live_join_requests_write_staff on public.live_join_requests for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- May this user enter this room?
--
-- One place answers it, so the classroom page, the token route and the
-- attendance log cannot disagree. Staff always may; a student needs the course
-- and a room that has not ended.
-- ---------------------------------------------------------------------------

create or replace function public.can_join_live(session_id uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.live_sessions s
    where s.id = session_id
      and s.status in ('scheduled', 'live')
      and (public.is_staff(uid) or public.has_course_access(s.course_id, uid))
  );
$$;

revoke all on function public.can_join_live(uuid, uuid) from public;
grant execute on function public.can_join_live(uuid, uuid) to authenticated, service_role;

/** Record attendance. Idempotent: rejoining after a dropped connection reuses the open row. */
create or replace function public.live_join(session_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); pid uuid;
begin
  if uid is null or not public.can_join_live(session_id, uid) then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;

  select id into pid from public.live_participants
   where live_participants.session_id = live_join.session_id
     and user_id = uid and left_at is null;
  if pid is not null then return pid; end if;

  insert into public.live_participants (session_id, user_id, role)
  values (session_id, uid,
          case when public.is_staff(uid) then 'host'::public.live_role
               else 'participant'::public.live_role end)
  returning id into pid;
  return pid;
end $$;

revoke all on function public.live_join(uuid) from public;
grant execute on function public.live_join(uuid) to authenticated, service_role;

/** Close the attendance row. Safe to call twice; a second call finds nothing open. */
create or replace function public.live_leave(session_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare touched integer;
begin
  update public.live_participants set left_at = now()
   where live_participants.session_id = live_leave.session_id
     and user_id = auth.uid() and left_at is null;
  get diagnostics touched = row_count;
  return touched > 0;
end $$;

revoke all on function public.live_leave(uuid) from public;
grant execute on function public.live_leave(uuid) to authenticated, service_role;

/** Host admits or refuses someone at the door. Staff only, and audited. */
create or replace function public.live_decide_join(request_id uuid, admit boolean)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare sid uuid;
begin
  if not public.is_staff() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;

  update public.live_join_requests
     set status = case when admit then 'approved'::public.join_state
                       else 'rejected'::public.join_state end,
         decided_at = now()
   where id = request_id and status = 'pending'
  returning session_id into sid;

  return sid is not null;
end $$;

revoke all on function public.live_decide_join(uuid, boolean) from public;
grant execute on function public.live_decide_join(uuid, boolean) to authenticated, service_role;
