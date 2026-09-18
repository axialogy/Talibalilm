-- ---------------------------------------------------------------------------
-- A room left open closes itself
--
-- The teacher opens the room, teaches, and forgets to end it — the tab is
-- closed, the laptop shuts, and the session sits `live` for ever. The list
-- then shows a class happening on a Tuesday three weeks ago, and the "join"
-- button keeps working.
--
-- Five hours is the school's ceiling for one class, so anything still running
-- past it was forgotten. `started_at` is the anchor rather than a heartbeat:
-- there is no reliable "last seen" for a room nobody is in, and a session that
-- genuinely ran five hours has ended whether or not anybody pressed stop.
--
-- Service role only, called by the sweep. Nothing here is reachable from a
-- session.
-- ---------------------------------------------------------------------------

create or replace function public.end_stale_live_sessions(max_hours integer default 5)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  closed integer;
begin
  update public.live_sessions
     set status = 'ended',
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where status = 'live'
     and started_at is not null
     and started_at < now() - make_interval(hours => greatest(1, max_hours));

  get diagnostics closed = row_count;
  return closed;
end;
$$;

revoke all on function public.end_stale_live_sessions(integer) from public;
grant execute on function public.end_stale_live_sessions(integer) to service_role;

comment on function public.end_stale_live_sessions(integer) is
  'Ends sessions still running past the school''s maximum length. Called by the sweep.';
