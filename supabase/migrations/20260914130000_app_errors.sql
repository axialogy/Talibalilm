-- ---------------------------------------------------------------------------
-- The crash log, where an admin can actually reach it
--
-- Next strips an error's message from the browser in production and leaves a
-- digest — correct, since a stack can name internals. `instrumentation.ts`
-- already catches the real thing in `onRequestError` and kept it in a fifteen
-- entry array IN MEMORY, which is where this fell down: Vercel runs many
-- instances, so by the time the office opens Admin → Diagnostic the request
-- lands on a different one and the list reads "aucune erreur enregistrée".
--
-- The evidence was captured and was unfetchable. That is the exact failure the
-- engineering notes were written against, half-fixed. Same cure as the rate
-- limiter (B8): move the record out of one instance's memory and into the one
-- place every instance already talks to.
--
-- Deliberately small and deliberately dumb. This is a debugging aid, not an
-- audit trail: two hundred rows, no user id, no headers, no cookies, no request
-- body. A crash log that grows without bound becomes a cost, and one that
-- records what the request carried becomes a data leak. Neither is worth a
-- stack trace.
-- ---------------------------------------------------------------------------

create table if not exists public.app_errors (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  -- The route pattern ('/[locale]/admin/courses/[id]'), never the filled path:
  -- a real URL can carry an id or a token, and this table is read on a screen.
  route      text not null default '',
  -- What the browser was shown. This is the whole point of the table: a person
  -- reads a code off an error page and gets the cause back.
  digest     text not null default '',
  name       text not null default '',
  message    text not null default '',
  -- The first few frames. Enough to name a file, not enough to be a dump.
  stack_head text not null default ''
);

create index if not exists app_errors_at_idx on public.app_errors (at desc);
create index if not exists app_errors_digest_idx on public.app_errors (digest);

-- Readable by staff, writable by nobody.
--
-- There is a SELECT policy and there is NO insert, update or delete policy at
-- all, so PostgREST refuses every write no matter who asks. The function below
-- is the only door, and it runs as the definer.
alter table public.app_errors enable row level security;
alter table public.app_errors force row level security;

drop policy if exists "app errors are admin reading" on public.app_errors;
create policy "app errors are admin reading"
  on public.app_errors for select
  using (public.is_admin());

revoke all on public.app_errors from anon, authenticated;
grant select on public.app_errors to anon, authenticated;

/**
 * Record one server error. Write-only, and it returns nothing.
 *
 * Granted to anon as well as authenticated because a crash happens to whoever
 * was on the page, and a logged-out visitor hitting a broken catalogue is
 * exactly the report nobody currently gets. It reads nothing back, so the grant
 * gives away no data — the SELECT policy above still decides who may look.
 *
 * Every field is truncated here rather than in the caller. A trace is written
 * on a path that is already failing, and the last thing that path needs is a
 * second error about a value being too long.
 */
create or replace function public.record_app_error(
  p_route text,
  p_digest text,
  p_name text,
  p_message text,
  p_stack_head text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- `clock_timestamp()`, not the column's `now()` default. `now()` is the
  -- TRANSACTION timestamp, so several rows written in one transaction share it
  -- exactly and the prune below cannot tell which is newest — it would then
  -- delete an arbitrary twenty. Wall-clock time gives every row a distinct
  -- instant and makes "keep the newest" mean what it says.
  insert into public.app_errors (at, route, digest, name, message, stack_head)
  values (
    clock_timestamp(),
    left(coalesce(p_route, ''), 200),
    left(coalesce(p_digest, ''), 100),
    left(coalesce(p_name, ''), 100),
    left(coalesce(p_message, ''), 2000),
    left(coalesce(p_stack_head, ''), 2000)
  );

  -- Keep the newest two hundred. Done here rather than in a scheduled job
  -- because the table must not be able to grow between sweeps, and because a
  -- crash log nobody prunes is how a free tier fills up quietly.
  delete from public.app_errors
  where id in (
    -- `id` as the tiebreak, so two rows landing on the same microsecond still
    -- order deterministically rather than by whatever the planner returns.
    select id from public.app_errors order by at desc, id desc offset 200
  );
end $$;

revoke all on function public.record_app_error(text, text, text, text, text) from public;
grant execute on function public.record_app_error(text, text, text, text, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
