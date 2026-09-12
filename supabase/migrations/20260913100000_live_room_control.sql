-- ---------------------------------------------------------------------------
-- Host controls for the live classroom
--
-- The room used to be an embedded third-party iframe, where every participant
-- arrived with the same powers because the public server will not mint the
-- signed moderator token that would separate them. The teacher joined their own
-- class as a student. That is the reason the room is being built here instead,
-- and it decides the shape of everything below: a host is not a flag the
-- browser sets, it is a fact the database already knows.
--
-- Two rules run through this file:
--
--   * Anything a host may do to a participant is stored, not shouted. A student
--     muted by the teacher who refreshes their tab must come back muted; a
--     realtime message alone would forget.
--   * Anything a student may be refused is refused HERE, not in React. The room
--     will hide the controls a student has no business seeing, but hiding is
--     cosmetic — the policies below and the Ably capability the server mints
--     are what make the refusal real.
-- ---------------------------------------------------------------------------

-- --- room policy the teacher sets per class --------------------------------

alter table public.live_sessions
  -- Students knock and wait rather than walking in. Off by default: a class is
  -- already gated by having bought the module, so the door is a second lock the
  -- teacher opts into, usually for an exam or a small group.
  add column require_approval boolean not null default false,
  -- The teacher can silence the room's chat without ending anything.
  add column chat_enabled boolean not null default true,
  -- Whether a student may turn their own camera on unasked. Off by default —
  -- fifty cameras in a lecture is not what anyone wants — so the normal path is
  -- a student asking and the teacher allowing.
  add column student_camera boolean not null default false,
  -- Same, for sharing a screen: a student asks, the teacher decides.
  add column student_screen boolean not null default false;

-- --- what the host has decided about one participant ------------------------

alter table public.live_participants
  add column muted boolean not null default false,
  add column camera_allowed boolean not null default false,
  add column screen_allowed boolean not null default false,
  -- Removed from the class. Not a deletion: the attendance row is a record that
  -- they were here, and `can_join_live` reads this to keep them out afterwards.
  add column banned_at timestamptz;

create index live_participants_banned_idx
  on public.live_participants (session_id) where banned_at is not null;

-- ---------------------------------------------------------------------------
-- A ban has to survive the door
--
-- `can_join_live` is what the room page, the attendance log and the realtime
-- token all ask. Removing someone has to change that answer, or they simply
-- reload and walk back in — so the ban is checked in the one place, rather than
-- in each of the three callers where it could be forgotten in one of them.
-- ---------------------------------------------------------------------------

create or replace function public.can_join_live(session_id uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.live_sessions s
    where s.id = session_id
      and s.status in ('scheduled', 'live')
      and (public.is_staff(uid) or public.has_course_access(s.course_id, uid))
  )
  and not exists (
    -- Staff are never banned from their own class; the check is for students.
    select 1 from public.live_participants p
    where p.session_id = can_join_live.session_id
      and p.user_id = uid
      and p.banned_at is not null
      and not public.is_staff(uid)
  );
$$;

revoke all on function public.can_join_live(uuid, uuid) from public;
grant execute on function public.can_join_live(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Chat
--
-- Ably carries a message to the people in the room; this table is what a late
-- joiner reads to catch up, and what the school still has afterwards. Ably is
-- the transport and Postgres is the record — neither substitutes for the other.
-- ---------------------------------------------------------------------------

create table public.live_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),

  -- Bounded on the way in. An unbounded text column reachable by every student
  -- in the class is a cheap way to fill a free-tier database.
  constraint live_messages_body_sane
    check (btrim(body) <> '' and length(body) <= 2000)
);

create index live_messages_room_idx on public.live_messages (session_id, created_at);

alter table public.live_messages enable row level security;
alter table public.live_messages force row level security;

revoke all on public.live_messages from anon, authenticated;
grant select, insert on public.live_messages to authenticated;
-- Nobody edits what was said. Staff may delete a message; that is the moderation
-- tool, and it is the only write that is not an insert.
grant delete on public.live_messages to authenticated;

create policy live_messages_select_inroom on public.live_messages for select
  to authenticated using (public.can_join_live(session_id));

-- A student may only speak as themselves, only in a room they can enter, and
-- only while the teacher has chat open. Muting therefore silences chat too,
-- which is what a teacher means by muting someone.
create policy live_messages_insert_own on public.live_messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_join_live(session_id)
    and exists (
      select 1 from public.live_sessions s
      where s.id = session_id and (s.chat_enabled or public.is_staff())
    )
    and not exists (
      select 1 from public.live_participants p
      where p.session_id = live_messages.session_id
        and p.user_id = auth.uid()
        and p.muted
        and not public.is_staff()
    )
  );

create policy live_messages_delete_staff on public.live_messages for delete
  to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- The whiteboard
--
-- Stored as the operations that drew it, not as a picture. A late joiner
-- replays them and arrives at the same board, which is the whole reason they
-- are here rather than only on the wire; clearing the board deletes them, so
-- the replay stays bounded by one lesson's drawing.
--
-- Only staff write. That is not a stylistic choice: the realtime token a
-- student receives carries no publish capability on the control channel, so
-- this policy and that token say the same thing in two places, and a student
-- has no path to either.
-- ---------------------------------------------------------------------------

create table public.live_board_ops (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  op         jsonb not null,
  created_at timestamptz not null default now(),

  -- One stroke, one shape or one label. Anything larger is not an operation,
  -- it is somebody sending the whole canvas, which is what this model exists
  -- to avoid.
  constraint live_board_ops_small check (pg_column_size(op) <= 8192)
);

create index live_board_ops_replay_idx on public.live_board_ops (session_id, id);

alter table public.live_board_ops enable row level security;
alter table public.live_board_ops force row level security;

revoke all on public.live_board_ops from anon, authenticated;
grant select on public.live_board_ops to authenticated;
grant insert, delete on public.live_board_ops to authenticated;

create policy live_board_select_inroom on public.live_board_ops for select
  to authenticated using (public.can_join_live(session_id));

create policy live_board_write_staff on public.live_board_ops for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Host actions on one participant
--
-- A security-definer function rather than a policy on `live_participants`,
-- because these writes are about somebody else's row and the audit has to name
-- the teacher who made the decision. `auth.uid()` is the real admin because the
-- call arrives on the ordinary authenticated connection.
-- ---------------------------------------------------------------------------

create or replace function public.live_set_participant(
  target_session uuid,
  target_user uuid,
  set_muted boolean default null,
  set_camera boolean default null,
  set_screen boolean default null,
  set_banned boolean default null
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare touched integer;
begin
  if not public.is_staff() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;

  -- A teacher cannot ban themselves out of their own classroom.
  if coalesce(set_banned, false) and public.is_staff(target_user) then
    raise exception 'cannot remove a member of staff' using errcode = 'check_violation';
  end if;

  update public.live_participants
     set muted          = coalesce(set_muted, muted),
         camera_allowed = coalesce(set_camera, camera_allowed),
         screen_allowed = coalesce(set_screen, screen_allowed),
         banned_at      = case
                            when set_banned is null then banned_at
                            when set_banned then now()
                            else null
                          end
   where session_id = target_session
     and user_id = target_user
     and left_at is null;

  get diagnostics touched = row_count;
  return touched > 0;
end $$;

revoke all on function public.live_set_participant(uuid, uuid, boolean, boolean, boolean, boolean) from public;
grant execute on function public.live_set_participant(uuid, uuid, boolean, boolean, boolean, boolean)
  to authenticated, service_role;

/**
 * What this user is allowed to do in this room, answered in one place.
 *
 * The room page, the Ably token endpoint and the chat policy all need the same
 * answer, and three copies of it would be three chances to disagree. Returns
 * null when the user may not be in the room at all.
 */
create or replace function public.live_room_state(session_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when not public.can_join_live(live_room_state.session_id) then null
    else jsonb_build_object(
      'is_host', public.is_staff(),
      'chat_enabled', s.chat_enabled,
      'require_approval', s.require_approval,
      'student_camera', s.student_camera,
      'student_screen', s.student_screen,
      'muted', coalesce(p.muted, false),
      'camera_allowed', public.is_staff() or s.student_camera or coalesce(p.camera_allowed, false),
      'screen_allowed', public.is_staff() or s.student_screen or coalesce(p.screen_allowed, false)
    )
  end
  from public.live_sessions s
  left join public.live_participants p
    on p.session_id = s.id and p.user_id = auth.uid() and p.left_at is null
  where s.id = live_room_state.session_id;
$$;

revoke all on function public.live_room_state(uuid) from public;
grant execute on function public.live_room_state(uuid) to authenticated, service_role;
