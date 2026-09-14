-- ---------------------------------------------------------------------------
-- A lesson video can live in our own bucket
--
-- Until now a lesson pointed at YouTube or Google Drive and the page built an
-- iframe from the id. That stays — it is free, it is where the school already
-- puts long recordings, and it costs us no storage. What it cannot do is hold a
-- file the teacher simply has on their laptop, so this adds R2 beside it.
--
-- WHY THE ENUM VALUE IS ADDED HERE AND USED NOWHERE IN SQL.
-- Postgres refuses to *use* an enum value added in the same transaction. The
-- Supabase SQL editor wraps a whole paste in one transaction, so a later
-- statement here saying `video_provider = 'r2'` would fail the entire script
-- and look exactly like nothing happened. `20260912100000_video_drive.sql` was
-- written around the same trap. The value is added; the application uses it.
-- ---------------------------------------------------------------------------

alter type public.video_provider add value if not exists 'r2';

-- ---------------------------------------------------------------------------
-- What we know about an uploaded file
--
-- `video_bytes` is the size MEASURED server-side after the upload, never the
-- one the browser claimed: a presigned PUT cannot cap what is actually sent, so
-- the only trustworthy figure is the one read back from the object.
--
-- `video_expires_at` is the school's retention decision. Null means keep it.
-- A date means the sweep deletes the object and clears these columns once it
-- passes — R2 charges by the gigabyte-month, and a term's recordings left in
-- place forever is a bill that only grows.
-- ---------------------------------------------------------------------------
alter table public.lesson_content
  add column if not exists video_bytes       bigint not null default 0,
  add column if not exists video_uploaded_at timestamptz,
  add column if not exists video_expires_at  timestamptz;

comment on column public.lesson_content.video_bytes is
  'Size of the uploaded object, measured server-side. 0 when the video is a YouTube/Drive link.';
comment on column public.lesson_content.video_expires_at is
  'When the sweep should delete the uploaded object. Null means keep it indefinitely.';

-- The sweep reads exactly this: a partial index, because the overwhelming
-- majority of rows have no expiry and should not be scanned.
create index if not exists lesson_content_video_expiry_idx
  on public.lesson_content (video_expires_at)
  where video_expires_at is not null;

-- ---------------------------------------------------------------------------
-- How much is stored
--
-- Drawn on the admin overview beside the 10 GB free tier, so the school can see
-- a bill coming rather than discover it. Staff-only, and a definer function so
-- it is one aggregate rather than a policy-filtered read of every row.
-- ---------------------------------------------------------------------------
create or replace function public.lesson_video_total_bytes()
returns bigint
language sql stable security definer set search_path = public, pg_temp as $$
  select case when public.is_staff() then
    coalesce((select sum(video_bytes) from public.lesson_content), 0)
  else 0 end;
$$;

revoke all on function public.lesson_video_total_bytes() from public;
grant execute on function public.lesson_video_total_bytes() to authenticated, service_role;
