-- ---------------------------------------------------------------------------
-- Unconfirmed signups, cleaned up
--
-- Spam registrations never confirm their address: the account exists, cannot
-- sign in, holds nothing, and makes the students list look like it has
-- customers. Supabase will not let them in, and the approval gate will not let
-- them buy — but they accumulate, and the office asked for them gone.
--
-- This hands the sweep the ids to delete. Two rules make it safe:
--
--   * the address was never confirmed, AND
--   * the account has no order.
--
-- The second is the one that matters: a student whose confirmation e-mail was
-- lost still has a profile and may have paid at the desk, and deleting them
-- would orphan a sale. `orders.user_id` is `on delete restrict` and would
-- refuse anyway; checking here means the sweep does not log a failure per
-- account for a case that is not a fault.
--
-- The sweep calls this, then deletes through the auth admin API — the only
-- thing that can remove a user — and it is deliberately capped, so one run
-- cannot take out thousands of rows in a single pass.
-- ---------------------------------------------------------------------------

create or replace function public.unconfirmed_users(older_than interval)
returns table (id uuid, email text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.email::text, u.created_at
  from auth.users u
  where u.email_confirmed_at is null
    and u.created_at < now() - older_than
    and not exists (select 1 from public.orders o where o.user_id = u.id)
  order by u.created_at asc
  limit 200;
$$;

revoke all on function public.unconfirmed_users(interval) from public;
grant execute on function public.unconfirmed_users(interval) to service_role;
