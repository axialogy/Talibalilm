-- ---------------------------------------------------------------------------
-- Teaching schema: courses, modules, lessons, enrolment and progress.
--
-- The access model here is the whole point of the rebuild, so read this first.
--
-- The spec asks for two things that cannot both live in one table under RLS:
--   * the syllabus outline must be PUBLIC — it is the sales page
--   * lesson content and video ids must be MEMBERS ONLY
--
-- Postgres RLS is row-level. One policy cannot expose a row's title while
-- hiding its `content`. So the gated fields live in `lesson_content`, a
-- separate table keyed 1:1 to `lessons` with its own policy. `lessons` stays
-- world-readable and carries only what a shopper may see: title, type,
-- position, duration, and whether it is a free preview.
--
-- This is a deliberate departure from the schema as written in the build spec.
-- ---------------------------------------------------------------------------

create type public.course_level as enum ('all', 'beginner', 'intermediate', 'advanced');
create type public.course_format as enum ('presentiel', 'visio', 'hybride');
create type public.course_status as enum ('draft', 'published', 'archived');
create type public.lesson_type as enum ('video', 'text', 'live', 'quiz', 'assignment');
create type public.video_provider as enum ('bunny', 'youtube', 'none');
create type public.membership_status as enum ('active', 'expired', 'cancelled');
create type public.progress_status as enum ('not_started', 'in_progress', 'completed');

-- ---------------------------------------------------------------------------
-- Memberships
--
-- Phase 3 owns the purchase flow — plans, orders, coupons, Stripe. But the
-- gate below has to be real and testable NOW, and "member" has to mean
-- something, so the table it reads lands here. Phase 3 adds `plan_id`,
-- `source_order_id` and the grant function on top of this.
-- ---------------------------------------------------------------------------

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  status      public.membership_status not null default 'active',
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint memberships_period check (expires_at > starts_at)
);

-- One live membership per person. Renewal extends `expires_at` rather than
-- inserting a second row, which is what makes rule 6 (early renewal stacks)
-- expressible without reconciling overlapping rows.
create unique index memberships_one_active_per_user
  on public.memberships (user_id)
  where status = 'active';

create index memberships_expiry_idx on public.memberships (expires_at)
  where status = 'active';

create trigger memberships_touch_updated_at
  before update on public.memberships
  for each row execute function public.touch_updated_at();

/**
 * The single source of truth for "may this person learn?".
 *
 * security definer so it can read `memberships` from inside a policy on
 * another table without that table's reader needing rights here. Checks the
 * clock, not just the status column: a row left `active` past its expiry must
 * not grant access, so the nightly job flipping statuses is a tidy-up, never
 * the enforcement.
 */
create or replace function public.has_active_membership(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships
    where user_id = uid and status = 'active' and expires_at > now()
  );
$$;

revoke all on function public.has_active_membership(uuid) from public;
grant execute on function public.has_active_membership(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------

create table public.courses (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  subtitle       text not null default '',
  description    text not null default '',
  -- The discipline's Arabic name. Printed on the generated cover art; not a
  -- translation of `title`, which stays French (see docs/PHASE-1.md).
  title_ar       text not null default '',
  cover_url      text,
  tone           text not null default 'emerald',
  category       text not null default 'fiqh',
  level          public.course_level not null default 'all',
  format         public.course_format not null default 'hybride',
  -- The language TAUGHT, not the language of the page.
  language       text not null default 'fr',
  instructor_id  uuid references public.profiles (id) on delete set null,
  status         public.course_status not null default 'draft',
  published_at   timestamptz,
  display_order  integer not null default 0,
  schedule       text not null default '',
  duration_weeks integer not null default 0,
  objectives     jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint courses_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint courses_objectives_is_array check (jsonb_typeof(objectives) = 'array'),
  -- A published course without a date would sort unpredictably and break the
  -- sitemap's lastmod.
  constraint courses_published_has_date
    check (status <> 'published' or published_at is not null)
);

create index courses_published_idx on public.courses (display_order, published_at desc)
  where status = 'published';
create index courses_category_idx on public.courses (category) where status = 'published';

create trigger courses_touch_updated_at
  before update on public.courses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Modules
-- ---------------------------------------------------------------------------

create table public.modules (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  title      text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (course_id, position) deferrable initially deferred
);

create index modules_course_idx on public.modules (course_id, position);

create trigger modules_touch_updated_at
  before update on public.modules
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Lessons — the PUBLIC half
--
-- Everything here is readable by anyone when the parent course is published.
-- Nothing here reveals the teaching itself.
-- ---------------------------------------------------------------------------

create table public.lessons (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references public.modules (id) on delete cascade,
  title            text not null,
  slug             text not null,
  type             public.lesson_type not null default 'video',
  position         integer not null default 0,
  duration_seconds integer not null default 0,
  -- true means playable with no membership: the free sample.
  is_preview       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (module_id, position) deferrable initially deferred,
  constraint lessons_duration_sane check (duration_seconds between 0 and 86400)
);

create index lessons_module_idx on public.lessons (module_id, position);

create trigger lessons_touch_updated_at
  before update on public.lessons
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Lesson content — the GATED half
--
-- Split out precisely because RLS cannot hide a column. A non-member's query
-- against this table returns zero rows; there is no shape of request that
-- returns the body or the video id. The video id never reaches a non-member's
-- browser, which is the requirement the old plugin failed.
-- ---------------------------------------------------------------------------

create table public.lesson_content (
  lesson_id      uuid primary key references public.lessons (id) on delete cascade,
  content        text not null default '',
  video_provider public.video_provider not null default 'none',
  -- Never a playable URL: an opaque id the server exchanges for a short-lived
  -- signed URL at request time. Storing a URL here would make a leak permanent.
  video_id       text,
  attachments    jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint lesson_content_attachments_is_array check (jsonb_typeof(attachments) = 'array'),
  constraint lesson_content_video_id_not_url
    check (video_id is null or video_id !~* '^https?://')
);

create trigger lesson_content_touch_updated_at
  before update on public.lesson_content
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Enrolment and progress
--
-- Enrolment is a bookmark, never a gate — rule 3 says one membership unlocks
-- everything, so requiring a separate enrolment would contradict it. It exists
-- so "my courses" and `last_accessed_at` have somewhere to live, and it is
-- created on first access rather than by an explicit act.
-- ---------------------------------------------------------------------------

create table public.enrollments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  enrolled_at      timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),

  unique (user_id, course_id)
);

create index enrollments_user_idx on public.enrollments (user_id, last_accessed_at desc);

create table public.lesson_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  lesson_id       uuid not null references public.lessons (id) on delete cascade,
  status          public.progress_status not null default 'not_started',
  seconds_watched integer not null default 0,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, lesson_id),
  constraint lesson_progress_seconds_sane check (seconds_watched >= 0),
  constraint lesson_progress_completed_has_date
    check (status <> 'completed' or completed_at is not null)
);

create index lesson_progress_user_idx on public.lesson_progress (user_id, lesson_id);

create trigger lesson_progress_touch_updated_at
  before update on public.lesson_progress
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Visibility helpers
--
-- security definer so a policy on `lessons` can consult `courses` without the
-- reader needing rights there, and so the join cannot be turned into an
-- information leak by a crafted query.
-- ---------------------------------------------------------------------------

create or replace function public.course_is_public(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.courses where id = cid and status = 'published');
$$;

create or replace function public.module_is_public(mid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.modules m
    join public.courses c on c.id = m.course_id
    where m.id = mid and c.status = 'published'
  );
$$;

/** True when the lesson belongs to a published course, preview or not. */
create or replace function public.lesson_is_published(lid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = lid and c.status = 'published'
  );
$$;

/** True when the lesson is a free sample of a published course. */
create or replace function public.lesson_is_preview(lid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = lid and l.is_preview and c.status = 'published'
  );
$$;

revoke all on function public.course_is_public(uuid) from public;
revoke all on function public.module_is_public(uuid) from public;
revoke all on function public.lesson_is_published(uuid) from public;
revoke all on function public.lesson_is_preview(uuid) from public;
grant execute on function public.course_is_public(uuid) to anon, authenticated, service_role;
grant execute on function public.module_is_public(uuid) to anon, authenticated, service_role;
grant execute on function public.lesson_is_published(uuid) to anon, authenticated, service_role;
grant execute on function public.lesson_is_preview(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.memberships     enable row level security;
alter table public.courses         enable row level security;
alter table public.modules         enable row level security;
alter table public.lessons         enable row level security;
alter table public.lesson_content  enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lesson_progress enable row level security;

alter table public.memberships     force row level security;
alter table public.courses         force row level security;
alter table public.modules         force row level security;
alter table public.lessons         force row level security;
alter table public.lesson_content  force row level security;
alter table public.enrollments     force row level security;
alter table public.lesson_progress force row level security;

-- ---- Memberships: yours to read, never yours to write --------------------
create policy memberships_select_own on public.memberships for select
  to authenticated using (user_id = auth.uid());
create policy memberships_select_staff on public.memberships for select
  to authenticated using (public.is_staff());
-- No insert/update/delete policy at all. Granting membership is a
-- service-role action from a verified payment or an audited admin action.

-- ---- Courses: the catalogue is the sales page ----------------------------
create policy courses_select_published on public.courses for select
  to anon, authenticated using (status = 'published');
create policy courses_select_staff on public.courses for select
  to authenticated using (public.is_staff());
create policy courses_write_staff on public.courses for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---- Modules ------------------------------------------------------------
create policy modules_select_published on public.modules for select
  to anon, authenticated using (public.course_is_public(course_id));
create policy modules_select_staff on public.modules for select
  to authenticated using (public.is_staff());
create policy modules_write_staff on public.modules for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---- Lessons: titles are public, deliberately ---------------------------
create policy lessons_select_published on public.lessons for select
  to anon, authenticated using (public.module_is_public(module_id));
create policy lessons_select_staff on public.lessons for select
  to authenticated using (public.is_staff());
create policy lessons_write_staff on public.lessons for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---- Lesson content: THE gate -------------------------------------------
-- A free preview, an active membership, or staff. Nothing else, ever.
create policy lesson_content_select_preview on public.lesson_content for select
  to anon, authenticated using (public.lesson_is_preview(lesson_id));
create policy lesson_content_select_member on public.lesson_content for select
  to authenticated using (
    public.has_active_membership() and public.lesson_is_published(lesson_id)
  );
create policy lesson_content_select_staff on public.lesson_content for select
  to authenticated using (public.is_staff());
create policy lesson_content_write_staff on public.lesson_content for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---- Enrolment and progress: strictly your own --------------------------
create policy enrollments_select_own on public.enrollments for select
  to authenticated using (user_id = auth.uid());
create policy enrollments_insert_own on public.enrollments for insert
  to authenticated with check (user_id = auth.uid() and public.has_active_membership());
create policy enrollments_update_own on public.enrollments for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy enrollments_select_staff on public.enrollments for select
  to authenticated using (public.is_staff());

create policy progress_select_own on public.lesson_progress for select
  to authenticated using (user_id = auth.uid());
create policy progress_insert_own on public.lesson_progress for insert
  to authenticated with check (user_id = auth.uid() and public.has_active_membership());
create policy progress_update_own on public.lesson_progress for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy progress_select_staff on public.lesson_progress for select
  to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Grants
--
-- `anon` gets SELECT on the catalogue and on lesson_content — the policy is
-- what limits the latter to previews. It gets nothing on membership, enrolment
-- or progress, so those are refused before a policy is even consulted.
-- ---------------------------------------------------------------------------

revoke all on public.memberships, public.courses, public.modules, public.lessons,
              public.lesson_content, public.enrollments, public.lesson_progress
  from anon, authenticated;

grant select on public.courses, public.modules, public.lessons, public.lesson_content
  to anon, authenticated;

grant select on public.memberships to authenticated;
grant select, insert, update on public.enrollments to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;

-- Staff authoring goes through the policies above, which need the privilege
-- to exist before the policy can allow it.
grant insert, update, delete on public.courses, public.modules, public.lessons,
                                public.lesson_content
  to authenticated;
