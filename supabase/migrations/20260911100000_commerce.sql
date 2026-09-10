-- ---------------------------------------------------------------------------
-- Commerce: cursus, products, offers, orders and entitlements.
--
-- This REPLACES the one-membership-unlocks-everything rule that Phase 2 built
-- and tested. The institute sells two things now:
--
--   * Cursus Module      — you buy the modules you want, one at a time.
--   * Cursus Approfondi  — you enrol in a structured, multi-year programme and
--                          get every module in that year of it.
--
-- Both are annual and neither auto-renews, so the 365-day clock and the
-- stacking rule survive intact. What changes is the SHAPE of the grant: a
-- boolean "is a member" becomes a set of entitlements, each pointing at a
-- course or at one year of a cursus.
--
-- Everything is priced per delivery mode. `presentiel` and `online` are two
-- separate programmes with separate prices, and a module in the on-site
-- programme is not automatically in the online one.
--
-- Money is integer cents throughout. No floats touch a price, ever.
-- ---------------------------------------------------------------------------

create type public.delivery_mode  as enum ('presentiel', 'online');
create type public.cursus_kind    as enum ('module', 'approfondi');
create type public.product_kind   as enum ('module', 'cursus');
create type public.catalog_status as enum ('draft', 'published', 'archived');
create type public.entitlement_scope as enum ('course', 'cursus', 'site');
create type public.order_status   as enum ('pending', 'paid', 'failed', 'refunded', 'cancelled');
create type public.payment_route  as enum ('paypal', 'office', 'free');
create type public.pack_pricing   as enum ('sum', 'fixed', 'percent');

-- ---------------------------------------------------------------------------
-- Cursus
--
-- Exactly two rows in practice, but a table rather than an enum: each carries
-- a title, a description and a public page, and the school will want to edit
-- those without a migration.
-- ---------------------------------------------------------------------------

create table public.cursus (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  kind          public.cursus_kind not null,
  title         text not null,
  subtitle      text not null default '',
  description   text not null default '',
  -- How many years the programme runs. 1 for the à-la-carte cursus.
  year_count    integer not null default 1,
  status        public.catalog_status not null default 'draft',
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint cursus_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint cursus_year_count_sane check (year_count between 1 and 10)
);

create trigger cursus_touch_updated_at
  before update on public.cursus
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The programme: which modules a cursus covers, in which year, in which mode.
--
-- `delivery` is part of the key on purpose. The on-site Approfondi and the
-- online Approfondi are different programmes that happen to share a name, and
-- a student who paid for one must not read the other's modules.
-- ---------------------------------------------------------------------------

create table public.cursus_courses (
  cursus_id  uuid not null references public.cursus (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  delivery   public.delivery_mode not null,
  year_index integer not null default 1,
  position   integer not null default 0,

  primary key (cursus_id, course_id, delivery, year_index),
  constraint cursus_courses_year_sane check (year_index between 1 and 10)
);

create index cursus_courses_course_idx on public.cursus_courses (course_id);

-- ---------------------------------------------------------------------------
-- Products — the things that carry a price.
--
-- A product is one purchasable offering: this module, on site, this year; or
-- year 2 of the Approfondi, online. Prices live here and nowhere else, which
-- is what lets the checkout recompute a total from ids alone and never trust
-- an amount posted by a browser.
-- ---------------------------------------------------------------------------

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  kind          public.product_kind not null,
  course_id     uuid references public.courses (id) on delete cascade,
  cursus_id     uuid references public.cursus (id) on delete cascade,
  year_index    integer not null default 1,
  delivery      public.delivery_mode not null,
  price_cents   integer not null,
  currency      text not null default 'EUR',
  -- How long the entitlement this product grants lasts. 365 by the spec's
  -- rule 5; a column rather than a constant so a summer intensive can differ.
  duration_days integer not null default 365,
  status        public.catalog_status not null default 'draft',
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint products_price_sane check (price_cents >= 0),
  constraint products_currency_shape check (currency ~ '^[A-Z]{3}$'),
  constraint products_duration_sane check (duration_days between 1 and 3650),
  constraint products_year_sane check (year_index between 1 and 10),
  -- A product points at exactly one thing.
  constraint products_target check (
    (kind = 'module' and course_id is not null and cursus_id is null)
    or (kind = 'cursus' and cursus_id is not null and course_id is null)
  )
);

-- One live price per offering. Changing a price means editing the row, which
-- keeps order history honest: `order_items` snapshots the price it charged.
create unique index products_one_per_module
  on public.products (course_id, delivery)
  where kind = 'module' and status <> 'archived';
create unique index products_one_per_cursus_year
  on public.products (cursus_id, year_index, delivery)
  where kind = 'cursus' and status <> 'archived';

create index products_published_idx on public.products (delivery, display_order)
  where status = 'published';

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Packs — the school's offers.
--
-- "Take the Arabic module and the French one is free" is a pack with two
-- items, the second flagged free, priced `sum`. "Any three modules for 500 €"
-- is priced `fixed`. Neither is expressed in code: the admin builds the row.
-- ---------------------------------------------------------------------------

create table public.packs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  description     text not null default '',
  delivery        public.delivery_mode not null,
  pricing         public.pack_pricing not null default 'sum',
  -- Used when pricing = 'fixed'.
  price_cents     integer,
  -- Used when pricing = 'percent'. 25 means a quarter off.
  percent_off     integer,
  currency        text not null default 'EUR',
  status          public.catalog_status not null default 'draft',
  starts_at       timestamptz,
  ends_at         timestamptz,
  -- null means unlimited.
  max_redemptions integer,
  redeemed_count  integer not null default 0,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint packs_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint packs_window check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint packs_fixed_has_price check (pricing <> 'fixed' or price_cents is not null),
  constraint packs_percent_has_percent check (pricing <> 'percent' or percent_off is not null),
  constraint packs_percent_range check (percent_off is null or percent_off between 1 and 100),
  constraint packs_price_sane check (price_cents is null or price_cents >= 0),
  constraint packs_redemptions_sane check (
    redeemed_count >= 0 and (max_redemptions is null or redeemed_count <= max_redemptions)
  )
);

create table public.pack_items (
  pack_id    uuid not null references public.packs (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  -- The giveaway half of a "buy one get one" offer.
  is_free    boolean not null default false,
  position   integer not null default 0,

  primary key (pack_id, product_id)
);

create trigger packs_touch_updated_at
  before update on public.packs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Coupons — including the office-cash route.
--
-- A 100 %-off single-use coupon is how a cash payment at the desk becomes the
-- same order as a card payment: identical rows, one code path, one grant.
-- ---------------------------------------------------------------------------

create table public.coupons (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  percent_off     integer,
  amount_off_cents integer,
  currency        text not null default 'EUR',
  max_redemptions integer,
  redeemed_count  integer not null default 0,
  expires_at      timestamptz,
  -- Marks the batch generated for the front desk, so cash takings can be
  -- reconciled without guessing from the discount amount.
  is_office       boolean not null default false,
  batch           text not null default '',
  note            text not null default '',
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint coupons_code_shape check (code ~ '^[A-Z0-9-]{6,32}$'),
  constraint coupons_has_a_discount check (
    (percent_off is not null) <> (amount_off_cents is not null)
  ),
  constraint coupons_percent_range check (percent_off is null or percent_off between 1 and 100),
  constraint coupons_amount_sane check (amount_off_cents is null or amount_off_cents > 0),
  -- The race guard. An application that reads then writes can oversell a
  -- single-use code under concurrency; this makes the database refuse.
  constraint coupons_redemptions_sane check (
    redeemed_count >= 0 and (max_redemptions is null or redeemed_count <= max_redemptions)
  )
);

create index coupons_batch_idx on public.coupons (batch) where batch <> '';

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete restrict,
  status            public.order_status not null default 'pending',
  route             public.payment_route not null,
  delivery          public.delivery_mode not null,
  subtotal_cents    integer not null default 0,
  discount_cents    integer not null default 0,
  total_cents       integer not null default 0,
  currency          text not null default 'EUR',
  coupon_id         uuid references public.coupons (id) on delete set null,
  pack_id           uuid references public.packs (id) on delete set null,
  -- PayPal's order id. Unique so a replayed webhook cannot create a second
  -- order, and nullable because the office route never has one.
  provider_order_id text,
  provider_capture_id text,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint orders_amounts_sane check (
    subtotal_cents >= 0 and discount_cents >= 0 and total_cents >= 0
  ),
  constraint orders_total_math check (total_cents = subtotal_cents - discount_cents),
  constraint orders_discount_within_subtotal check (discount_cents <= subtotal_cents),
  constraint orders_paid_has_date check (status <> 'paid' or paid_at is not null),
  constraint orders_currency_shape check (currency ~ '^[A-Z]{3}$')
);

create unique index orders_provider_order_id_key on public.orders (provider_order_id)
  where provider_order_id is not null;
create index orders_user_idx on public.orders (user_id, created_at desc);

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  -- restrict, not cascade: deleting a product must not rewrite what someone
  -- was charged.
  product_id      uuid not null references public.products (id) on delete restrict,
  -- Snapshots, so a later price edit cannot rewrite history.
  kind            public.product_kind not null,
  course_id       uuid references public.courses (id) on delete set null,
  cursus_id       uuid references public.cursus (id) on delete set null,
  year_index      integer not null default 1,
  delivery        public.delivery_mode not null,
  unit_price_cents integer not null,
  duration_days   integer not null,
  is_free         boolean not null default false,
  title           text not null default '',

  unique (order_id, product_id),
  constraint order_items_price_sane check (unit_price_cents >= 0),
  constraint order_items_free_is_free check (not is_free or unit_price_cents = 0)
);

create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- The arithmetic is the database's job, not the application's.
--
-- A pricing bug that overcharges or undercharges is the most expensive kind of
-- bug here, so `orders.subtotal_cents` is checked against the items it claims
-- to summarise. Deferred, because the order row and its items are inserted in
-- one transaction and neither can come first.
-- ---------------------------------------------------------------------------

create or replace function public.assert_order_subtotal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid := coalesce(new.order_id, old.order_id);
  claimed integer;
  actual integer;
begin
  select o.subtotal_cents into claimed from public.orders o where o.id = target;
  if claimed is null then return null; end if;   -- order deleted with its items

  select coalesce(sum(i.unit_price_cents), 0) into actual
  from public.order_items i where i.order_id = target;

  if claimed <> actual then
    raise exception
      'order % claims a subtotal of % but its items sum to %', target, claimed, actual
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger order_items_sum_matches_subtotal
  after insert or update or delete on public.order_items
  deferrable initially deferred
  for each row execute function public.assert_order_subtotal();

-- ---------------------------------------------------------------------------
-- Entitlements — what a paid order actually hands over.
--
-- This replaces `memberships`. A row says: this person may learn this course
-- (or this year of this cursus, in this delivery mode) until this instant.
-- ---------------------------------------------------------------------------

create table public.entitlements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  scope           public.entitlement_scope not null,
  course_id       uuid references public.courses (id) on delete cascade,
  cursus_id       uuid references public.cursus (id) on delete cascade,
  year_index      integer not null default 1,
  delivery        public.delivery_mode not null default 'online',
  status          public.membership_status not null default 'active',
  starts_at       timestamptz not null default now(),
  expires_at      timestamptz not null,
  source_order_id uuid references public.orders (id) on delete set null,
  granted_by      uuid references public.profiles (id) on delete set null,
  note            text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint entitlements_period check (expires_at > starts_at),
  constraint entitlements_year_sane check (year_index between 1 and 10),
  constraint entitlements_target check (
    (scope = 'course' and course_id is not null and cursus_id is null)
    or (scope = 'cursus' and cursus_id is not null and course_id is null)
    or (scope = 'site' and course_id is null and cursus_id is null)
  )
);

-- One live entitlement per target, which is what makes rule 6 expressible:
-- renewing early extends `expires_at` on the row that exists instead of
-- inserting a second one that would have to be reconciled.
create unique index entitlements_one_active_course
  on public.entitlements (user_id, course_id, delivery)
  where status = 'active' and scope = 'course';
create unique index entitlements_one_active_cursus
  on public.entitlements (user_id, cursus_id, year_index, delivery)
  where status = 'active' and scope = 'cursus';
create unique index entitlements_one_active_site
  on public.entitlements (user_id)
  where status = 'active' and scope = 'site';

create index entitlements_user_idx on public.entitlements (user_id)
  where status = 'active';
create index entitlements_expiry_idx on public.entitlements (expires_at)
  where status = 'active';

create trigger entitlements_touch_updated_at
  before update on public.entitlements
  for each row execute function public.touch_updated_at();

-- Carry across anything the previous model granted. A site-wide membership
-- keeps working; it is now one entitlement with scope 'site' rather than a
-- table of its own, and stays available as the admin's comp/scholarship grant.
insert into public.entitlements (user_id, scope, status, starts_at, expires_at, note)
select m.user_id, 'site', m.status, m.starts_at, m.expires_at,
       'migrated from memberships'
from public.memberships m;

-- The policies that named the old gate have to go before the function they
-- depend on can be dropped; the new ones are created further down.
drop policy lesson_content_select_member on public.lesson_content;
drop policy enrollments_insert_own on public.enrollments;
drop policy progress_insert_own on public.lesson_progress;

drop function public.has_active_membership(uuid);
drop table public.memberships;

-- ---------------------------------------------------------------------------
-- The gate
--
-- One question, asked of the database: may this person read this course?
-- security definer so a policy on `lesson_content` can consult `entitlements`
-- without its reader holding rights there. Checks the clock, not just the
-- status column — a row left `active` past its expiry grants nothing, so the
-- nightly sweep is a tidy-up and never the enforcement.
-- ---------------------------------------------------------------------------

create or replace function public.has_course_access(cid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = uid
      and e.status = 'active'
      and e.expires_at > now()
      and (
        -- A comp or scholarship grant: the whole institute.
        e.scope = 'site'
        -- Bought this module outright.
        or (e.scope = 'course' and e.course_id = cid)
        -- Enrolled in a cursus whose programme covers it, in the mode paid
        -- for. The on-site programme does not open the online one's modules.
        or (e.scope = 'cursus' and exists (
              select 1 from public.cursus_courses cc
              where cc.cursus_id = e.cursus_id
                and cc.course_id = cid
                and cc.year_index = e.year_index
                and cc.delivery = e.delivery
           ))
      )
  );
$$;

/** The same question phrased for a lesson, which is where the policy sits. */
create or replace function public.has_lesson_access(lid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = lid
      and c.status = 'published'
      and public.has_course_access(c.id, uid)
  );
$$;

/**
 * True when the person holds any live entitlement at all.
 *
 * Only for "do I show the buy button or the renew button" — never a gate. The
 * gate is always about a specific course.
 */
create or replace function public.has_any_entitlement(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.entitlements
    where user_id = uid and status = 'active' and expires_at > now()
  );
$$;

revoke all on function public.has_course_access(uuid, uuid) from public;
revoke all on function public.has_lesson_access(uuid, uuid) from public;
revoke all on function public.has_any_entitlement(uuid) from public;
grant execute on function public.has_course_access(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_lesson_access(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_any_entitlement(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The single grant path.
--
-- PayPal capture and the front desk's cash coupon both end here, so the two
-- routes cannot drift. Idempotent by `source_order_id`: PayPal retries its
-- webhooks, and a retry must not hand out a second year.
--
-- Renewal stacks. If a live entitlement for the same target exists, its expiry
-- moves forward by the product's duration instead of a second row appearing —
-- which is why the partial unique indexes above can be as strict as they are.
-- ---------------------------------------------------------------------------

create or replace function public.grant_order_entitlements(oid uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.orders%rowtype;
  item public.order_items%rowtype;
  granted integer := 0;
  touched integer;
begin
  select * into o from public.orders where id = oid for update;
  if not found then
    raise exception 'order % does not exist', oid using errcode = 'no_data_found';
  end if;
  if o.status <> 'paid' then
    raise exception 'order % is %, not paid', oid, o.status using errcode = 'check_violation';
  end if;

  -- Already granted. A replayed webhook lands here and leaves quietly.
  if exists (select 1 from public.entitlements where source_order_id = oid) then
    return 0;
  end if;

  for item in select * from public.order_items where order_id = oid loop
    if item.kind = 'module' then
      update public.entitlements
         set expires_at = greatest(expires_at, now()) + make_interval(days => item.duration_days),
             source_order_id = oid
       where user_id = o.user_id and status = 'active' and scope = 'course'
         and course_id = item.course_id and delivery = item.delivery;
      get diagnostics touched = row_count;

      if touched = 0 then
        insert into public.entitlements
          (user_id, scope, course_id, delivery, expires_at, source_order_id)
        values
          (o.user_id, 'course', item.course_id, item.delivery,
           now() + make_interval(days => item.duration_days), oid);
      end if;
    else
      update public.entitlements
         set expires_at = greatest(expires_at, now()) + make_interval(days => item.duration_days),
             source_order_id = oid
       where user_id = o.user_id and status = 'active' and scope = 'cursus'
         and cursus_id = item.cursus_id and year_index = item.year_index
         and delivery = item.delivery;
      get diagnostics touched = row_count;

      if touched = 0 then
        insert into public.entitlements
          (user_id, scope, cursus_id, year_index, delivery, expires_at, source_order_id)
        values
          (o.user_id, 'cursus', item.cursus_id, item.year_index, item.delivery,
           now() + make_interval(days => item.duration_days), oid);
      end if;
    end if;
    granted := granted + 1;
  end loop;

  return granted;
end;
$$;

revoke all on function public.grant_order_entitlements(uuid) from public;
grant execute on function public.grant_order_entitlements(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Coupon redemption.
--
-- The whole point is the WHERE clause. Read-then-write in the application lets
-- two simultaneous checkouts both see `redeemed_count = 0` on a single-use
-- code and both spend it; this update is one statement, so the second one
-- matches no row and is told the code is spent.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_coupon(coupon_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed uuid;
begin
  update public.coupons
     set redeemed_count = redeemed_count + 1
   where code = upper(coupon_code)
     and (expires_at is null or expires_at > now())
     and (max_redemptions is null or redeemed_count < max_redemptions)
  returning id into claimed;

  return claimed;   -- null means unknown, expired or spent. The caller decides.
end;
$$;

revoke all on function public.redeem_coupon(text) from public;
grant execute on function public.redeem_coupon(text) to service_role;

-- Nightly sweep. Purely cosmetic — `has_course_access` already ignores an
-- expired row — but it keeps admin listings honest and the partial indexes
-- small.
create or replace function public.expire_entitlements()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with done as (
    update public.entitlements set status = 'expired'
     where status = 'active' and expires_at <= now()
    returning 1
  )
  select count(*)::integer from done;
$$;

revoke all on function public.expire_entitlements() from public;
grant execute on function public.expire_entitlements() to service_role;

-- ---------------------------------------------------------------------------
-- RLS
--
-- The catalogue half — cursus, programmes, products, packs — is PUBLIC, and
-- deliberately so: it is the sales page, and it has to be indexable. The
-- ledger half — orders, entitlements, coupons — is private, readable by its
-- owner and by staff, and writable by nobody through the anon key at all.
-- ---------------------------------------------------------------------------

alter table public.cursus         enable row level security;
alter table public.cursus_courses enable row level security;
alter table public.products       enable row level security;
alter table public.packs          enable row level security;
alter table public.pack_items     enable row level security;
alter table public.coupons        enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.entitlements   enable row level security;

alter table public.cursus         force row level security;
alter table public.cursus_courses force row level security;
alter table public.products       force row level security;
alter table public.packs          force row level security;
alter table public.pack_items     force row level security;
alter table public.coupons        force row level security;
alter table public.orders         force row level security;
alter table public.order_items    force row level security;
alter table public.entitlements   force row level security;

/** True when the cursus is on public display. */
create or replace function public.cursus_is_public(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.cursus where id = cid and status = 'published');
$$;

/** True when the pack is on public display and inside its window. */
create or replace function public.pack_is_public(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.packs
    where id = pid
      and status = 'published'
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
  );
$$;

revoke all on function public.cursus_is_public(uuid) from public;
revoke all on function public.pack_is_public(uuid) from public;
grant execute on function public.cursus_is_public(uuid) to anon, authenticated, service_role;
grant execute on function public.pack_is_public(uuid) to anon, authenticated, service_role;

-- ---- Catalogue: browse freely, edit only as staff -------------------------
create policy cursus_select_published on public.cursus for select
  to anon, authenticated using (status = 'published');
create policy cursus_select_staff on public.cursus for select
  to authenticated using (public.is_staff());
create policy cursus_write_staff on public.cursus for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

create policy cursus_courses_select_published on public.cursus_courses for select
  to anon, authenticated using (
    public.cursus_is_public(cursus_id) and public.course_is_public(course_id)
  );
create policy cursus_courses_select_staff on public.cursus_courses for select
  to authenticated using (public.is_staff());
create policy cursus_courses_write_staff on public.cursus_courses for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

create policy products_select_published on public.products for select
  to anon, authenticated using (status = 'published');
create policy products_select_staff on public.products for select
  to authenticated using (public.is_staff());
create policy products_write_staff on public.products for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

create policy packs_select_published on public.packs for select
  to anon, authenticated using (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );
create policy packs_select_staff on public.packs for select
  to authenticated using (public.is_staff());
create policy packs_write_staff on public.packs for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

create policy pack_items_select_published on public.pack_items for select
  to anon, authenticated using (public.pack_is_public(pack_id));
create policy pack_items_select_staff on public.pack_items for select
  to authenticated using (public.is_staff());
create policy pack_items_write_staff on public.pack_items for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---- Coupons: never readable by a client ---------------------------------
-- Not even your own. A student who could list coupons could try the office
-- batch, and a percent-off code is worth money. Validation happens server-side
-- through `redeem_coupon`, which runs as the service role.
create policy coupons_select_admin on public.coupons for select
  to authenticated using (public.is_admin());
create policy coupons_write_admin on public.coupons for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- Orders: yours to read, never yours to write -------------------------
-- No insert or update policy for `authenticated` anywhere. An order is created
-- by a server action holding the service role, after it has priced the
-- selection itself. A browser that could insert an order could name its own
-- total.
create policy orders_select_own on public.orders for select
  to authenticated using (user_id = auth.uid());
create policy orders_select_staff on public.orders for select
  to authenticated using (public.is_staff());

create policy order_items_select_own on public.order_items for select
  to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );
create policy order_items_select_staff on public.order_items for select
  to authenticated using (public.is_staff());

-- ---- Entitlements: yours to read, never yours to write -------------------
create policy entitlements_select_own on public.entitlements for select
  to authenticated using (user_id = auth.uid());
create policy entitlements_select_staff on public.entitlements for select
  to authenticated using (public.is_staff());

-- ---- The gate, restated against entitlements -----------------------------
create policy lesson_content_select_member on public.lesson_content for select
  to authenticated using (public.has_lesson_access(lesson_id));

-- Enrolment stays a bookmark rather than a gate, but it may only be created
-- for a course the person can actually open.
create policy enrollments_insert_own on public.enrollments for insert
  to authenticated with check (user_id = auth.uid() and public.has_course_access(course_id));

create policy progress_insert_own on public.lesson_progress for insert
  to authenticated with check (user_id = auth.uid() and public.has_lesson_access(lesson_id));

-- ---------------------------------------------------------------------------
-- Grants
--
-- SELECT only, everywhere, for everyone but staff. Every write that matters —
-- an order, an entitlement, a coupon redemption — goes through a function
-- running as the service role, so there is no INSERT for a client to abuse.
-- ---------------------------------------------------------------------------

revoke all on public.cursus, public.cursus_courses, public.products,
              public.packs, public.pack_items, public.coupons,
              public.orders, public.order_items, public.entitlements
  from anon, authenticated;

grant select on public.cursus, public.cursus_courses, public.products,
                public.packs, public.pack_items
  to anon, authenticated;

grant select on public.orders, public.order_items, public.entitlements
  to authenticated;

-- Staff edit the catalogue through the same anon key their policies already
-- cover, so the write grants follow the write policies.
grant insert, update, delete on public.cursus, public.cursus_courses,
                                public.products, public.packs, public.pack_items,
                                public.coupons
  to authenticated;

grant select on public.coupons to authenticated;
