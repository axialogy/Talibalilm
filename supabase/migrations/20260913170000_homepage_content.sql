-- ---------------------------------------------------------------------------
-- Actualités & Événements, and what students say
--
-- Two sections the school's old site had and this one did not, both of them
-- content the office must write itself. Deliberately NOT seeded: an invented
-- event is a lie about a date, and an invented student quote is a lie about a
-- person. Both sections render nothing at all until there is a published row,
-- so an empty table shows an empty page rather than a heading over nothing.
--
-- Same access shape as the catalogue in 20260911100000_commerce.sql: a
-- published row is public, a draft is staff-only, and staff own every write.
-- ---------------------------------------------------------------------------

-- ---- Events ---------------------------------------------------------------
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  -- The Arabic title, like `courses.title_ar`: printed beside the French one,
  -- not a translation of the page.
  title_ar      text not null default '',
  excerpt       text not null default '',
  body          text not null default '',
  image_url     text,
  -- When it happens. Null for an announcement that is not tied to a date.
  starts_at     timestamptz,
  location      text not null default '',
  -- Optional: a registration form, a video, wherever the card should lead.
  href          text not null default '',
  status        public.catalog_status not null default 'draft',
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint events_title_present check (btrim(title) <> ''),
  constraint events_excerpt_length check (length(excerpt) <= 500)
);

create index if not exists events_published_idx
  on public.events (display_order, starts_at desc nulls last)
  where status = 'published';

alter table public.events enable row level security;

create policy events_select_published on public.events for select
  to anon, authenticated using (status = 'published');
create policy events_select_staff on public.events for select
  to authenticated using (public.is_staff());
create policy events_write_staff on public.events for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---- Student reviews ------------------------------------------------------
--
-- `author_name` is whatever the student agreed to be called. Nothing here is
-- joined to `profiles`: a testimonial is a quote the school was given, not a
-- fact about an account, and tying the two would make deleting an account
-- silently delete a published quote.
create table if not exists public.reviews (
  id             uuid primary key default gen_random_uuid(),
  author_name    text not null,
  -- "Cursus Approfondi, 2e année", "Étudiante en Fiqh" — whatever places them.
  author_context text not null default '',
  quote          text not null,
  rating         integer not null default 5,
  avatar_url     text,
  status         public.catalog_status not null default 'draft',
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint reviews_author_present check (btrim(author_name) <> ''),
  constraint reviews_quote_length check (length(btrim(quote)) between 10 and 1200),
  constraint reviews_rating_range check (rating between 1 and 5)
);

create index if not exists reviews_published_idx
  on public.reviews (display_order, created_at desc)
  where status = 'published';

alter table public.reviews enable row level security;

create policy reviews_select_published on public.reviews for select
  to anon, authenticated using (status = 'published');
create policy reviews_select_staff on public.reviews for select
  to authenticated using (public.is_staff());
create policy reviews_write_staff on public.reviews for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- Grants are table-level, matching the rest of the schema, so a column added
-- by a later migration is covered without a second grant being remembered.
grant select on public.events, public.reviews to anon, authenticated;
grant insert, update, delete on public.events, public.reviews to authenticated;

comment on table public.events is
  'Actualités & Événements on the home page. Published rows are public.';
comment on table public.reviews is
  'Student testimonials. A quote the school was given, not a row about a user.';
