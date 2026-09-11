-- ---------------------------------------------------------------------------
-- Storage for course cover images.
--
-- NOT a migration and NOT in the schema bundle: it touches Supabase's own
-- `storage` schema, which the offline test harness does not have. Run it once
-- against the real project, in the SQL editor, after the schema is in place.
--
-- The bucket is public-read — a cover is a marketing image on an indexable
-- page — and staff-write. `is_staff()` already exists from the profiles
-- migration and is the same gate the course editor uses everywhere else.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-covers', 'course-covers', true,
  5242880,                                   -- 5 MB, matched in the app
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read a cover.
drop policy if exists course_covers_read on storage.objects;
create policy course_covers_read on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'course-covers');

-- Only staff may add, replace or remove one.
drop policy if exists course_covers_write on storage.objects;
create policy course_covers_write on storage.objects for all
  to authenticated
  using (bucket_id = 'course-covers' and public.is_staff())
  with check (bucket_id = 'course-covers' and public.is_staff());
