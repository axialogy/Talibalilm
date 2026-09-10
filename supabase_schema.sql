-- ===================================================================
-- Grow & Glow — Supabase schema
-- ===================================================================
-- Run this once in the Supabase SQL editor.
--
-- The app works fully offline without it (everything lives in
-- localStorage). These tables activate only when VITE_SUPABASE_URL and
-- VITE_SUPABASE_ANON_KEY are set in the build environment.
--
-- EGRESS NOTES (why this design keeps the bill near zero):
--   1. Visitors make four small GETs per load: products, drops, published
--      reviews, published journal posts. Nothing else is read publicly.
--   2. Product photos live in Storage and are served from its CDN — never
--      embedded in table rows.
--   3. Admin notifications use ONE Realtime websocket carrying INSERT
--      events only (a few hundred bytes each). No polling anywhere.
-- ===================================================================

-- -------------------------------------------------------------------
-- Drops (collections)
-- -------------------------------------------------------------------
create table if not exists public.gg_drops (
  id           text primary key,
  slug         text not null unique,
  name         text not null,
  statement    text,
  description  text,
  cover_image  text,
  released_at  date not null default current_date,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- Products
-- -------------------------------------------------------------------
create table if not exists public.gg_products (
  id               text primary key,
  slug             text not null unique,
  name             text not null,
  tagline          text,
  description      text,
  category         text not null default 'tee'
                     check (category in ('tee','hoodie','crewneck','cap','accessory')),
  drop_id          text references public.gg_drops(id) on delete set null,
  material         text,
  sizes            jsonb not null default '[]'::jsonb,
  colors           jsonb not null default '[]'::jsonb,
  price            numeric not null default 0,
  old_price        numeric,
  offers           jsonb not null default '[]'::jsonb,
  images           jsonb not null default '[]'::jsonb,
  -- The reverse-printed message and where it sits on the garment
  mirror_message   text,
  mirror_placement text,
  -- Code printed as a hidden QR inside the care label
  unlock_code      text,
  features         jsonb not null default '[]'::jsonb,
  in_stock         boolean not null default true,
  featured         boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists gg_products_drop_idx on public.gg_products (drop_id);

-- -------------------------------------------------------------------
-- Orders (cash on delivery)
-- -------------------------------------------------------------------
create table if not exists public.gg_orders (
  id              text primary key,
  customer_name   text not null,
  phone           text,
  wilaya          text,
  address         text,
  delivery_method text check (delivery_method in ('home','desk')),
  notes           text,
  items           jsonb not null default '[]'::jsonb,
  subtotal        numeric not null default 0,
  delivery_fee    numeric not null default 0,
  total           numeric not null default 0,
  status          text not null default 'pending'
                    check (status in ('pending','confirmed','packed','shipped','delivered','cancelled')),
  created_at      timestamptz not null default now()
);

create index if not exists gg_orders_created_idx on public.gg_orders (created_at desc);

-- -------------------------------------------------------------------
-- Reviews
-- -------------------------------------------------------------------
create table if not exists public.gg_reviews (
  id           text primary key,
  product_id   text not null,
  product_name text not null,
  name         text not null,
  rating       int not null check (rating between 1 and 5),
  comment      text not null,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists gg_reviews_product_idx on public.gg_reviews (product_id);

-- -------------------------------------------------------------------
-- Journal
-- -------------------------------------------------------------------
create table if not exists public.gg_journal (
  id           text primary key,
  slug         text not null unique,
  title        text not null,
  excerpt      text,
  body         text,
  tag          text,
  read_minutes int not null default 2,
  cover_image  text,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- Unlock codes (the hidden QR on each care label)
-- -------------------------------------------------------------------
create table if not exists public.gg_unlocks (
  code         text primary key,
  product_name text,
  message      text,
  body         text,
  link_url     text,
  link_label   text,
  scans        int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- Customers
-- -------------------------------------------------------------------
-- Built automatically from placed orders, plus a rating and a private note
-- the shop keeps on each buyer. Cash on delivery means a refused parcel
-- costs real money, so "never ship to this one again" needs somewhere to
-- live that survives a browser reset.
create table if not exists public.gg_customers (
  id          text primary key,
  name        text not null,
  phone       text not null,
  wilaya      text,
  orders      int not null default 0,
  total_spent numeric not null default 0,
  tag         text not null default 'unrated'
                check (tag in ('unrated','good','regular','risky','blocked')),
  note        text,
  joined_at   timestamptz not null default now()
);

create index if not exists gg_customers_phone_idx on public.gg_customers (phone);

-- -------------------------------------------------------------------
-- Settings (single shared row)
-- -------------------------------------------------------------------
create table if not exists public.gg_settings (
  id         text primary key default 'main',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- Atomic scan counter
-- -------------------------------------------------------------------
-- Called from the storefront when a QR resolves. Doing the increment in
-- SQL keeps it correct when two people scan the same code at once, which
-- a read-then-write from the client would not.
create or replace function public.gg_increment_scan(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.gg_unlocks
     set scans = scans + 1
   where upper(code) = upper(p_code)
     and active;
$$;

-- ===================================================================
-- Row Level Security
-- ===================================================================
alter table public.gg_products enable row level security;
alter table public.gg_drops    enable row level security;
alter table public.gg_orders   enable row level security;
alter table public.gg_reviews  enable row level security;
alter table public.gg_journal  enable row level security;
alter table public.gg_unlocks  enable row level security;
alter table public.gg_settings enable row level security;
alter table public.gg_customers enable row level security;

-- Customers are never readable or writable by the public: these rows are
-- names, phone numbers and private notes. Only the demo-admin block below
-- opens them, and that block is the one you replace before launch.

-- ---- Public reads: catalog, drops, published reviews and posts ----
drop policy if exists "read products" on public.gg_products;
create policy "read products" on public.gg_products
  for select to anon using (true);

drop policy if exists "read published drops" on public.gg_drops;
create policy "read published drops" on public.gg_drops
  for select to anon using (published);

drop policy if exists "read published reviews" on public.gg_reviews;
create policy "read published reviews" on public.gg_reviews
  for select to anon using (published);

drop policy if exists "read published posts" on public.gg_journal;
create policy "read published posts" on public.gg_journal
  for select to anon using (published);

drop policy if exists "read active unlocks" on public.gg_unlocks;
create policy "read active unlocks" on public.gg_unlocks
  for select to anon using (active);

drop policy if exists "read settings" on public.gg_settings;
create policy "read settings" on public.gg_settings
  for select to anon using (true);

-- ---- Public writes: place an order, leave a review ----
-- Visitors can INSERT but never SELECT orders, so nobody can scrape other
-- people's addresses and phone numbers.
drop policy if exists "anon can place orders" on public.gg_orders;
create policy "anon can place orders" on public.gg_orders
  for insert to anon with check (true);

drop policy if exists "anon can submit reviews" on public.gg_reviews;
create policy "anon can submit reviews" on public.gg_reviews
  for insert to anon with check (published = false);

-- ===================================================================
-- !!  SECURITY — SUPERSEDED BY supabase_lockdown.sql  !!
-- ===================================================================
-- The dashboard in this build signs in on the client only (see
-- src/routes/admin.login.tsx) and talks to Supabase with the anon key.
-- For that to work at all, the policies below hand anon write access to
-- the catalog and to order status. That is fine for a demo or a private
-- staging link. It is NOT safe for a public production store: anyone who
-- reads the JS bundle can edit products and orders.
--
-- This is now handled: the dashboard signs in through Supabase Auth, and
-- `supabase_lockdown.sql` replaces every policy in this block with
-- authenticated-only equivalents. Run that file once the Auth build is live.
-- The block below is kept only so this file still describes a working demo
-- setup from scratch; a production database should not end here.
-- ===================================================================

drop policy if exists "demo admin writes products" on public.gg_products;
create policy "demo admin writes products" on public.gg_products
  for all to anon using (true) with check (true);

drop policy if exists "demo admin writes drops" on public.gg_drops;
create policy "demo admin writes drops" on public.gg_drops
  for all to anon using (true) with check (true);

drop policy if exists "demo admin writes journal" on public.gg_journal;
create policy "demo admin writes journal" on public.gg_journal
  for all to anon using (true) with check (true);

drop policy if exists "demo admin writes unlocks" on public.gg_unlocks;
create policy "demo admin writes unlocks" on public.gg_unlocks
  for all to anon using (true) with check (true);

drop policy if exists "demo admin updates orders" on public.gg_orders;
create policy "demo admin updates orders" on public.gg_orders
  for update to anon using (true) with check (true);

drop policy if exists "demo admin reads orders" on public.gg_orders;
create policy "demo admin reads orders" on public.gg_orders
  for select to anon using (true);

drop policy if exists "demo admin moderates reviews" on public.gg_reviews;
create policy "demo admin moderates reviews" on public.gg_reviews
  for update to anon using (true) with check (true);

drop policy if exists "demo admin deletes reviews" on public.gg_reviews;
create policy "demo admin deletes reviews" on public.gg_reviews
  for delete to anon using (true);

drop policy if exists "demo admin reads all reviews" on public.gg_reviews;
create policy "demo admin reads all reviews" on public.gg_reviews
  for select to anon using (true);

drop policy if exists "demo admin writes settings" on public.gg_settings;
create policy "demo admin writes settings" on public.gg_settings
  for all to anon using (true) with check (true);

drop policy if exists "demo admin writes customers" on public.gg_customers;
create policy "demo admin writes customers" on public.gg_customers
  for all to anon using (true) with check (true);

-- ===================================================================
-- Realtime — push new orders and reviews to the open dashboard
-- ===================================================================
alter publication supabase_realtime add table public.gg_orders;
alter publication supabase_realtime add table public.gg_reviews;

-- ===================================================================
-- Storage — product photos
-- ===================================================================
-- Create a PUBLIC bucket named `product-images` in the Storage UI, then:
--
--   create policy "public read product images" on storage.objects
--     for select to anon using (bucket_id = 'product-images');
--
--   create policy "demo admin uploads product images" on storage.objects
--     for insert to anon with check (bucket_id = 'product-images');
--
-- Tighten the second one to `authenticated` at the same time you tighten
-- the table policies above.
