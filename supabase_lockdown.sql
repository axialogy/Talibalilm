-- ===================================================================
-- Grow & Glow — production lockdown
-- ===================================================================
-- Replaces the demo policies from supabase_schema.sql, which granted the
-- anon key full write access so a client-side login could work.
--
-- RUN THIS ONLY AFTER the build using Supabase Auth is live. The previously
-- deployed bundle writes as `anon`; once these policies apply, that build's
-- dashboard can still read the shop but can no longer save anything.
--
-- After this runs:
--   anon  (every visitor) — reads the shop, places an order, submits a
--         review for moderation, opens an unlock code. Nothing else.
--   authenticated (the signed-in shop owner) — everything.
--
-- Note what anon specifically LOSES: reading gg_orders and gg_customers.
-- Those hold names, phone numbers, addresses and private notes, and were
-- readable by anyone with the public key until now.
-- ===================================================================

begin;

-- ---- Drop every demo-era policy -----------------------------------
drop policy if exists "demo admin writes products"    on public.gg_products;
drop policy if exists "demo admin writes drops"       on public.gg_drops;
drop policy if exists "demo admin writes journal"     on public.gg_journal;
drop policy if exists "demo admin writes unlocks"     on public.gg_unlocks;
drop policy if exists "demo admin writes settings"    on public.gg_settings;
drop policy if exists "demo admin writes customers"   on public.gg_customers;
drop policy if exists "demo admin updates orders"     on public.gg_orders;
drop policy if exists "demo admin reads orders"       on public.gg_orders;
drop policy if exists "demo admin moderates reviews"  on public.gg_reviews;
drop policy if exists "demo admin deletes reviews"    on public.gg_reviews;
drop policy if exists "demo admin reads all reviews"  on public.gg_reviews;

-- ---- Public reads: only what the storefront renders ---------------
drop policy if exists "read products" on public.gg_products;
create policy "read products" on public.gg_products
  for select to anon, authenticated using (true);

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

-- ---- Public writes: place an order, leave a review -----------------
-- Insert only. A visitor still cannot read back what anyone else submitted.
drop policy if exists "anon can place orders" on public.gg_orders;
create policy "anon can place orders" on public.gg_orders
  for insert to anon with check (true);

drop policy if exists "anon can submit reviews" on public.gg_reviews;
create policy "anon can submit reviews" on public.gg_reviews
  for insert to anon with check (published = false);

-- ---- The shop owner, signed in, gets everything --------------------
create policy "owner manages products"  on public.gg_products
  for all to authenticated using (true) with check (true);
create policy "owner manages drops"     on public.gg_drops
  for all to authenticated using (true) with check (true);
create policy "owner manages journal"   on public.gg_journal
  for all to authenticated using (true) with check (true);
create policy "owner manages unlocks"   on public.gg_unlocks
  for all to authenticated using (true) with check (true);
create policy "owner manages settings"  on public.gg_settings
  for all to authenticated using (true) with check (true);
create policy "owner manages orders"    on public.gg_orders
  for all to authenticated using (true) with check (true);
create policy "owner manages reviews"   on public.gg_reviews
  for all to authenticated using (true) with check (true);
create policy "owner manages customers" on public.gg_customers
  for all to authenticated using (true) with check (true);

commit;

-- ---- Storage: public read, owner-only upload ----------------------
drop policy if exists "gg demo admin uploads images" on storage.objects;
drop policy if exists "gg owner uploads images"      on storage.objects;
create policy "gg owner uploads images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "gg owner updates images" on storage.objects;
create policy "gg owner updates images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "gg owner deletes images" on storage.objects;
create policy "gg owner deletes images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

notify pgrst, 'reload schema';
