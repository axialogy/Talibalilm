-- ---------------------------------------------------------------------------
-- The prefix was never actually optional
--
-- `admin_generate_coupons` built the code as
--     nullif(prefix, '') || case when prefix <> '' then '-' else '' end || <random>
-- With no prefix, `nullif('', '')` is NULL, and NULL || text is NULL in
-- Postgres — so the whole code came out NULL. The length guard did not catch
-- it either: `length(NULL) < 6` is NULL, not true, so `continue` never fired
-- and the NULL reached the INSERT. That raises not_null_violation, which the
-- handler below only catches for unique_violation — so the admin saw a bare
-- "Enregistrement impossible" with no code generated.
--
-- Same function, one line changed: build the prefix segment with a plain CASE
-- that yields '' rather than NULL. Also widen the inner handler to not_null
-- and check_violation so a malformed code can never masquerade as a collision.
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
    -- optional prefix + 8 random base32-ish chars, upper-case, within 6..32.
    new_code := left(
      case when prefix <> '' then prefix || '-' else '' end ||
      upper(translate(encode(gen_random_bytes(6), 'base64'), '+/=', 'XYZ')),
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
