-- ---------------------------------------------------------------------------
-- What a product actually is, and where the PayPal keys live.
--
-- The school's own planning page groups its offerings by TIME SLOT, not just
-- by delivery mode: "Sciences Islamiques FR, Vendredi 18h30-21h30, 90h/an,
-- 490 €" sits under "Présentiel — Semaine Soir", and the same course runs
-- again under "Week-end Matin" at its own price. So one course has SEVERAL
-- products in the same delivery mode, which the unique index written in the
-- commerce migration forbade. It is rebuilt here with the slot in the key.
-- ---------------------------------------------------------------------------

alter table public.products
  -- 'semaine-soir', 'weekend-matin', 'dimanche' — the school's own grouping,
  -- free text rather than an enum because the timetable changes yearly and
  -- adding a slot must not need a migration.
  add column time_slot      text not null default '',
  -- "Vendredi 18h30-21h30", printed as written.
  add column schedule_label text not null default '',
  add column hours_per_year integer,
  -- Tenths of an hour, so "3h/semaine" is 30 and a 90-minute class is 15.
  -- Integer because a float has no business anywhere near a contract.
  add column hours_per_week integer,
  -- The language the class is TAUGHT in, which is what splits the francophone
  -- and arabophone cursus.
  add column language       text not null default 'fr',

  add constraint products_hours_year_sane
    check (hours_per_year is null or hours_per_year between 1 and 2000),
  add constraint products_hours_week_sane
    check (hours_per_week is null or hours_per_week between 1 and 700),
  add constraint products_language_known check (language in ('fr', 'ar'));

drop index public.products_one_per_module;
drop index public.products_one_per_cursus_year;

create unique index products_one_per_module_slot
  on public.products (course_id, delivery, time_slot, language)
  where kind = 'module' and status <> 'archived';
create unique index products_one_per_cursus_year_slot
  on public.products (cursus_id, year_index, delivery, time_slot, language)
  where kind = 'cursus' and status <> 'archived';

create index products_slot_idx on public.products (delivery, time_slot, display_order)
  where status = 'published';

-- Snapshot the slot onto the order line too, so an invoice still says which
-- class was bought after next year's timetable has replaced it.
alter table public.order_items
  add column time_slot      text not null default '',
  add column schedule_label text not null default '';

-- ---------------------------------------------------------------------------
-- Payment settings
--
-- The school enters its own PayPal credentials rather than asking for a
-- redeploy. That puts a live API secret in a database row, so the grants here
-- are the strictest in the schema:
--
--   * NO grant to anon or authenticated. Not select, not insert. An admin's
--     browser session cannot read this table at all, so a stolen session
--     cannot exfiltrate the secret.
--   * The service role reads it server-side when it talks to PayPal.
--   * Admins write it through a server action, and read back only
--     `payment_settings_status()` — which returns whether a secret is set,
--     never the secret.
--
-- An environment variable, when present, still wins. A key in Vercel's
-- encrypted store is safer than a key in a table, so the table is the
-- convenience path, not the recommended one.
-- ---------------------------------------------------------------------------

create type public.paypal_environment as enum ('sandbox', 'live');

create table public.payment_settings (
  id            boolean primary key default true,
  environment   public.paypal_environment not null default 'sandbox',
  client_id     text not null default '',
  client_secret text not null default '',
  webhook_id    text not null default '',
  merchant_email text not null default '',
  currency      text not null default 'EUR',
  enabled       boolean not null default false,
  updated_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),

  -- One row, forever. `id` is a boolean pinned to true, which is the cheapest
  -- singleton Postgres offers.
  constraint payment_settings_singleton check (id),
  constraint payment_settings_currency_shape check (currency ~ '^[A-Z]{3}$'),
  -- Switching it on without credentials would fail at the worst moment: when a
  -- student clicks pay.
  constraint payment_settings_enabled_is_configured check (
    not enabled or (client_id <> '' and client_secret <> '')
  )
);

insert into public.payment_settings (id) values (true);

create trigger payment_settings_touch_updated_at
  before update on public.payment_settings
  for each row execute function public.touch_updated_at();

alter table public.payment_settings enable row level security;
alter table public.payment_settings force row level security;

-- Deliberately no policy for `authenticated`. There is nothing to allow: the
-- role holds no grant on the table, so RLS never even gets asked.
revoke all on public.payment_settings from anon, authenticated;

/**
 * What an admin is allowed to know about the payment configuration.
 *
 * Reports whether each secret is present, never what it is. The client id is
 * returned in full because PayPal publishes it in the browser SDK anyway.
 */
create or replace function public.payment_settings_status()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare s public.payment_settings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;

  select * into s from public.payment_settings where id;

  return json_build_object(
    'environment', s.environment,
    'client_id', s.client_id,
    'merchant_email', s.merchant_email,
    'currency', s.currency,
    'enabled', s.enabled,
    'has_secret', s.client_secret <> '',
    'has_webhook_id', s.webhook_id <> '',
    'updated_at', s.updated_at
  );
end;
$$;

revoke all on function public.payment_settings_status() from public;
grant execute on function public.payment_settings_status() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Giving a coupon back.
--
-- A code is SPENT when the order is created, not when it is paid: two
-- simultaneous checkouts must not both be told a single-use code is theirs,
-- and finding out at capture — after the student's money has moved — is far
-- worse than finding out at the basket. The cost is that an abandoned checkout
-- eats a code, so this hands it back when an order is cancelled or its payment
-- fails.
--
-- `greatest(0, ...)` because a double release must not create redemptions out
-- of nothing.
-- ---------------------------------------------------------------------------

create or replace function public.release_coupon(coupon_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.coupons
     set redeemed_count = greatest(0, redeemed_count - 1)
   where id = coupon_id
  returning true;
$$;

revoke all on function public.release_coupon(uuid) from public;
grant execute on function public.release_coupon(uuid) to service_role;
