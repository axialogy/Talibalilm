-- ---------------------------------------------------------------------------
-- What the school says about itself, and what visitors say back
--
-- Two things the office could not change without a deploy: the announcement
-- strip across the top of every page, and the social links in the footer. Both
-- become one row, editable from the admin panel.
--
-- And the other direction: a visitor with a question had a `mailto:` link and
-- nothing else. `contact_messages` stores what they write, so a message cannot
-- be lost to a mail provider having a bad afternoon.
-- ---------------------------------------------------------------------------

-- ---- Site settings --------------------------------------------------------
--
-- Exactly one row, enforced by the primary key rather than by convention: the
-- key is a boolean fixed at `true`, so a second row cannot be inserted and
-- every read can be `.maybeSingle()` without an `order by` to break a tie.
create table if not exists public.site_settings (
  id                   boolean primary key default true,
  announcement_text    text not null default '',
  -- Optional: the strip becomes a link when set, plain text when not.
  announcement_href    text not null default '',
  announcement_enabled boolean not null default false,

  facebook             text not null default '',
  instagram            text not null default '',
  tiktok               text not null default '',
  youtube              text not null default '',
  -- A wa.me link or a bare international number; the page builds the URL.
  whatsapp             text not null default '',

  updated_at           timestamptz not null default now(),

  constraint site_settings_single_row check (id),
  constraint site_settings_announcement_length check (length(announcement_text) <= 300)
);

-- Seeded here so the admin screen always has a row to edit and the public read
-- always has a row to find. Disabled, and empty: the school writes the words.
insert into public.site_settings (id) values (true) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- Public by nature — it is the footer and a banner. Writes are staff only.
create policy site_settings_select_all on public.site_settings for select
  to anon, authenticated using (true);
create policy site_settings_write_staff on public.site_settings for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

-- ---- Contact messages -----------------------------------------------------
--
-- A stranger may leave one and may never read one back. That asymmetry is the
-- whole policy: `insert` for `anon`, `select` for staff, and no select for
-- anyone else — so the table cannot be turned into a list of who has written
-- to the school and what they said.
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  subject    text not null default '',
  body       text not null,
  -- Marked when the office has dealt with it. Not a delete: a question
  -- answered is still a record of having been asked.
  handled_at timestamptz,
  created_at timestamptz not null default now(),

  constraint contact_messages_name_shape check (length(btrim(name)) between 2 and 120),
  constraint contact_messages_email_shape check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint contact_messages_subject_shape check (length(subject) <= 200),
  constraint contact_messages_body_shape check (length(btrim(body)) between 10 and 4000)
);

create index if not exists contact_messages_unhandled_idx
  on public.contact_messages (created_at desc)
  where handled_at is null;

alter table public.contact_messages enable row level security;

-- The lengths are checked by the constraints above, which run on every insert
-- whatever the client does. The policy's job is only to say who may write.
create policy contact_messages_insert_anyone on public.contact_messages for insert
  to anon, authenticated with check (true);

create policy contact_messages_select_staff on public.contact_messages for select
  to authenticated using (public.is_staff());
create policy contact_messages_update_staff on public.contact_messages for update
  to authenticated using (public.is_staff()) with check (public.is_staff());
create policy contact_messages_delete_staff on public.contact_messages for delete
  to authenticated using (public.is_staff());

-- Insert only for the public. No select grant for `anon` at all, so even a
-- policy mistake later cannot turn this into a readable mailbox.
grant insert on public.contact_messages to anon, authenticated;
grant select, update, delete on public.contact_messages to authenticated;

comment on table public.site_settings is
  'One row. The announcement strip and the school''s social links.';
comment on table public.contact_messages is
  'Messages left by visitors. Insert-only for the public, readable by staff.';
