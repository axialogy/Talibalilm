-- ---------------------------------------------------------------------------
-- What an order is holding, and how to give it back.
--
-- An order claims two scarce things when it opens: a coupon redemption and a
-- pack redemption. Both were claimed and neither was ever returned unless the
-- student clicked PayPal's own cancel button — so a failed payment, or a
-- closed tab, cost the school a code worth a year of teaching. This adds the
-- bookkeeping that makes returning them safe to do more than once, because a
-- sweep that runs twice must not invent redemptions.
--
-- It also adds the other direction. A refunded or reversed payment has to be
-- able to take access back, which nothing could do before: `refunded` existed
-- in the enum and was unreachable.
-- ---------------------------------------------------------------------------

alter table public.orders
  -- Stamped when the hold is given back. Null means still held; the timestamp
  -- is what makes release idempotent rather than a decrement that drifts.
  add column coupon_released_at timestamptz,
  add column pack_released_at   timestamptz,
  -- Why the order ended up in its current status: 'refunded by PayPal',
  -- 'abandoned', 'capture denied'. Read by the office, so it is prose.
  add column status_reason      text not null default '';

create index orders_pending_idx on public.orders (created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Claiming a pack redemption
--
-- Same shape as `redeem_coupon`, and for the same reason: the limit lives in
-- the WHERE clause, so two simultaneous checkouts cannot both take the last
-- one. `packs.max_redemptions` has existed since the table was created and
-- nothing ever incremented the counter, which made every limited offer
-- unlimited.
-- ---------------------------------------------------------------------------

create or replace function public.claim_pack(pack_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare claimed uuid;
begin
  if pack_id is null then return true; end if;   -- no pack, nothing to claim

  update public.packs
     set redeemed_count = redeemed_count + 1
   where id = pack_id
     and status = 'published'
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at > now())
     and (max_redemptions is null or redeemed_count < max_redemptions)
  returning id into claimed;

  return claimed is not null;
end;
$$;

revoke all on function public.claim_pack(uuid) from public;
grant execute on function public.claim_pack(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Giving both holds back
--
-- Idempotent by the stamps above: calling it twice returns the second call
-- false and changes nothing. The sweep below and the cancel route both call
-- it, and they race by design.
-- ---------------------------------------------------------------------------

create or replace function public.release_order_holds(oid uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.orders%rowtype;
  released boolean := false;
begin
  select * into o from public.orders where id = oid for update;
  if not found then return false; end if;

  -- A paid order keeps what it took. Releasing there would hand a spent code
  -- back for someone else to use while the first student still has access.
  if o.status = 'paid' then return false; end if;

  if o.coupon_id is not null and o.coupon_released_at is null then
    update public.coupons
       set redeemed_count = greatest(0, redeemed_count - 1)
     where id = o.coupon_id;
    update public.orders set coupon_released_at = now() where id = oid;
    released := true;
  end if;

  if o.pack_id is not null and o.pack_released_at is null then
    update public.packs
       set redeemed_count = greatest(0, redeemed_count - 1)
     where id = o.pack_id;
    update public.orders set pack_released_at = now() where id = oid;
    released := true;
  end if;

  return released;
end;
$$;

revoke all on function public.release_order_holds(uuid) from public;
grant execute on function public.release_order_holds(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Sweeping abandoned checkouts
--
-- A student who closes the tab on PayPal's page never reaches our cancel
-- route, so nothing told us to let go. Thirty minutes is longer than any
-- honest checkout and shorter than anyone's patience waiting for a code to
-- work again.
-- ---------------------------------------------------------------------------

create or replace function public.expire_pending_orders(older_than interval default interval '30 minutes')
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid;
  swept integer := 0;
begin
  for target in
    select id from public.orders
     where status = 'pending' and created_at < now() - older_than
  loop
    perform public.release_order_holds(target);
    update public.orders
       set status = 'cancelled',
           status_reason = case when status_reason = '' then 'abandoned' else status_reason end
     where id = target and status = 'pending';
    swept := swept + 1;
  end loop;

  return swept;
end;
$$;

revoke all on function public.expire_pending_orders(interval) from public;
grant execute on function public.expire_pending_orders(interval) to service_role;

-- ---------------------------------------------------------------------------
-- Taking access back
--
-- A refund, a denial, a reversal or a lost dispute all mean the same thing:
-- the money went back and the access must follow. Before this there was no
-- way to express that, so a refunded student kept their year.
--
-- The entitlement is not deleted. Its expiry is wound back by exactly the days
-- this order paid for, which is the only correct answer once renewals stack —
-- a student who bought twice and was refunded once should keep the other year.
-- If that takes the expiry to now or earlier, the row is marked cancelled and
-- `has_course_access` stops honouring it on the clock, as it always did.
-- ---------------------------------------------------------------------------

create or replace function public.revoke_order_entitlements(oid uuid, reason text default '')
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.orders%rowtype;
  item public.order_items%rowtype;
  touched integer := 0;
begin
  select * into o from public.orders where id = oid for update;
  if not found then
    raise exception 'order % does not exist', oid using errcode = 'no_data_found';
  end if;

  -- `entitlements_period` insists a row cannot end before it begins, and it is
  -- a plain CHECK, so it is evaluated at the end of every statement. Winding
  -- the expiry back in one statement and repairing the start in the next
  -- therefore fails on the first — both have to move together. On the right of
  -- the assignment `expires_at` is still the old value, which is what makes
  -- that expressible.
  for item in select * from public.order_items where order_id = oid loop
    if item.kind = 'module' then
      update public.entitlements
         set expires_at = expires_at - make_interval(days => item.duration_days),
             starts_at  = least(
               starts_at,
               expires_at - make_interval(days => item.duration_days) - interval '1 second'
             )
       where user_id = o.user_id and scope = 'course'
         and course_id = item.course_id and delivery = item.delivery;
    else
      update public.entitlements
         set expires_at = expires_at - make_interval(days => item.duration_days),
             starts_at  = least(
               starts_at,
               expires_at - make_interval(days => item.duration_days) - interval '1 second'
             )
       where user_id = o.user_id and scope = 'cursus'
         and cursus_id = item.cursus_id and year_index = item.year_index
         and delivery = item.delivery;
    end if;
    touched := touched + 1;
  end loop;

  -- Anything wound back to or past now is spent. `has_course_access` already
  -- ignores it on the clock; this only keeps the listings honest.
  update public.entitlements
     set status = 'cancelled'
   where user_id = o.user_id and status = 'active' and expires_at <= now();

  update public.orders
     set status = 'refunded',
         status_reason = case when reason = '' then 'refunded' else reason end
   where id = oid;

  return touched;
end;
$$;

revoke all on function public.revoke_order_entitlements(uuid, text) from public;
grant execute on function public.revoke_order_entitlements(uuid, text) to service_role;
