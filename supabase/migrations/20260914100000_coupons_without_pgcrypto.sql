-- ---------------------------------------------------------------------------
-- The coupon generator could never have worked on Supabase
--
-- It failed with
--     [42883] function gen_random_bytes(integer) does not exist
-- which reads like a missing migration and is not one. The migration was there.
-- The FUNCTION IT CALLS was not reachable.
--
-- `gen_random_bytes` belongs to pgcrypto. `20260910120000_profiles.sql` says
-- `create extension if not exists "pgcrypto"` and that line is a no-op here,
-- because Supabase ships pgcrypto already installed — in the `extensions`
-- schema, not in `public`. Meanwhile `admin_generate_coupons` is declared
-- `set search_path = public, pg_temp`, which is correct and deliberate: pinning
-- the search path is what stops a caller shadowing `coupons` with their own
-- table inside a SECURITY DEFINER function. But it also means the function
-- cannot see anything in `extensions`.
--
-- So the guard that makes the function safe is the same thing that makes it
-- fail, and `create extension if not exists` reports success while changing
-- nothing. Three correct-looking pieces, one broken result.
--
-- Adding `extensions` to the search path would fix it and widen the definer
-- function's trust surface to a schema we do not control. Dropping the
-- dependency is better: `gen_random_uuid()` has been in POSTGRES CORE since
-- version 13 — no extension, nothing to install, nothing to put on a search
-- path — and it is a cryptographically strong random source, which matters for
-- a code worth a year of access.
--
-- A uuid rendered as hex gives A-F and 0-9. That alphabet cannot produce the
-- pairs people mistype over the phone — no O to confuse with 0, no I to
-- confuse with 1 — which the old base64 alphabet could and did.
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
  prefix text := coalesce(upper(regexp_replace(coalesce(code_prefix, ''), '[^A-Za-z0-9-]', '', 'g')), '');
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

    -- Optional prefix + 10 hex characters from a uuid. 16^10 is about 1.1e12,
    -- and a collision merely retries below, so the length is about legibility
    -- rather than exhaustion.
    new_code := left(
      case when prefix <> '' then prefix || '-' else '' end ||
      upper(left(replace(gen_random_uuid()::text, '-', ''), 10)),
      32);
    new_code := regexp_replace(new_code, '[^A-Z0-9-]', '', 'g');
    if new_code is null or length(new_code) < 6 then continue; end if;

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
-- The same trap, one table over
--
-- `live_sessions.room_token` defaults to `encode(gen_random_bytes(16), 'hex')`.
-- A column default is evaluated with the SESSION's search path, so it happens
-- to work for an ordinary client on Supabase — and would fail the moment a
-- definer function with a pinned search path inserted a session. Same fix, made
-- now rather than after somebody spends an afternoon on it.
-- ---------------------------------------------------------------------------
alter table public.live_sessions
  alter column room_token
  set default replace(gen_random_uuid()::text, '-', '') ||
              replace(gen_random_uuid()::text, '-', '');
