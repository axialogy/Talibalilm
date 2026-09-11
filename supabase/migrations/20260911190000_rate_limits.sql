-- ---------------------------------------------------------------------------
-- Rate limiting that actually holds across instances (audit B8).
--
-- The in-process limiter it replaces counted in one serverless instance's
-- memory and reset on every cold start, so login and coupon redemption were
-- effectively unthrottled. Office codes are worth a year of access, so brute
-- force pays; this makes the counter shared and durable by putting it in the
-- one place every instance already talks to.
--
-- A fixed window keyed by (bucket, time-slot). One atomic upsert per hit — the
-- increment and the limit test are the same statement, so two requests racing
-- cannot both slip under the cap.
-- ---------------------------------------------------------------------------

create table public.rate_limit_counters (
  id         text primary key,   -- '<bucket>:<slot>', e.g. 'login:1.2.3.4:29384756'
  count      integer not null default 0,
  expires_at timestamptz not null
);

create index rate_limit_counters_expiry_idx on public.rate_limit_counters (expires_at);

-- No client may read or write it directly. The function below is the only door,
-- and it runs as the definer.
alter table public.rate_limit_counters enable row level security;
alter table public.rate_limit_counters force row level security;
revoke all on public.rate_limit_counters from anon, authenticated;

/**
 * Record one hit against a bucket and say whether it is still under the limit.
 *
 * Returns { allowed, remaining, retry_after }. `allowed` is false once the
 * count for the current window exceeds `max_hits`; `retry_after` is the seconds
 * until the window rolls over. Granted to anon as well as authenticated because
 * the very first thing it protects — the login form — is used before anyone is
 * signed in. Calling it more often only counts against the caller.
 */
create or replace function public.rate_limit_hit(
  bucket text, max_hits integer, window_seconds integer
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  slot bigint := floor(extract(epoch from now()) / window_seconds);
  key text := bucket || ':' || slot::text;
  win_end timestamptz := to_timestamp((slot + 1) * window_seconds);
  new_count integer;
begin
  insert into public.rate_limit_counters (id, count, expires_at)
  values (key, 1, win_end)
  on conflict (id) do update set count = rate_limit_counters.count + 1
  returning count into new_count;

  return jsonb_build_object(
    'allowed', new_count <= max_hits,
    'remaining', greatest(0, max_hits - new_count),
    'retry_after',
      case when new_count <= max_hits then 0
           else ceil(extract(epoch from (win_end - now())))::int end
  );
end $$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public;
grant execute on function public.rate_limit_hit(text, integer, integer) to anon, authenticated, service_role;

/** Drop windows that have rolled over. Called by the sweep; cheap and safe to run often. */
create or replace function public.prune_rate_limits()
returns integer
language sql security definer set search_path = public, pg_temp as $$
  with gone as (
    delete from public.rate_limit_counters where expires_at < now() returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function public.prune_rate_limits() from public;
grant execute on function public.prune_rate_limits() to service_role;
