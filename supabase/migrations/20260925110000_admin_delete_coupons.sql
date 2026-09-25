-- ---------------------------------------------------------------------------
-- Deleting coupon codes for good
--
-- The office generates codes in batches and asked for the used ones to leave
-- the list. `admin_void_coupon` deliberately does not delete — a redeemed code
-- has orders pointing at it, and the comment there says the history matters.
-- That is the right policy for the void button; it is not a law about the
-- table. `orders.coupon_id` and `installments.coupon_id` are both
-- `on delete set null`, so a delete keeps the money record and drops only the
-- link to the code.
--
-- This is a deliberate, audited action, not a background cleanup. One audit
-- row per coupon, written from the rows the DELETE returns, so "who deleted
-- this batch" is answerable after the rows themselves are gone. The function
-- returns how many were removed.
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_coupons(ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row record;
  removed integer := 0;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;

  if ids is null or array_length(ids, 1) is null then
    return 0;
  end if;

  -- DELETE ... RETURNING as a FOR query is supported by plpgsql, and it is the
  -- only way to audit a code whose row is being removed in the same breath.
  for row in
    delete from public.coupons where id = any(ids) returning id, code
  loop
    perform public.record_admin_action(
      'coupon.delete',
      'coupon',
      row.id::text,
      '',
      jsonb_build_object('code', row.code)
    );
    removed := removed + 1;
  end loop;

  return removed;
end;
$$;

revoke all on function public.admin_delete_coupons(uuid[]) from public;
grant execute on function public.admin_delete_coupons(uuid[]) to authenticated, service_role;
