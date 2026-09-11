-- ---------------------------------------------------------------------------
-- Fixtures for the Prisma RLS tests.
--
-- Two people and two courses, with one entitlement between them. That is the
-- smallest arrangement that can tell "the module you bought" apart from "the
-- one you did not", which is the assertion the whole Prisma decision rests on.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('b0000000-0000-4000-8000-000000000001', 'buyer@test.fr',  '{"full_name":"Acheteur"}'::jsonb),
  ('b0000000-0000-4000-8000-000000000002', 'nobody@test.fr', '{"full_name":"Personne"}'::jsonb);

insert into public.courses (id, slug, title, status, published_at) values
  ('c1000000-0000-4000-8000-000000000001', 'fiqh',  'Fiqh',  'published', now()),
  ('c1000000-0000-4000-8000-000000000002', 'aqida', 'Aqida', 'published', now());
insert into public.modules (id, course_id, title, position) values
  ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'M1', 1),
  ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'M1', 1);
insert into public.lessons (id, module_id, title, slug, position, duration_seconds, is_preview) values
  ('e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Fiqh 1', 'f1', 1, 600, false),
  ('e1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'Aqida 1', 'a1', 1, 600, false);
insert into public.lesson_content (lesson_id, content, video_provider, video_id) values
  ('e1000000-0000-4000-8000-000000000001', 'Contenu fiqh.',  'bunny', 'SECRET-FIQH'),
  ('e1000000-0000-4000-8000-000000000002', 'Contenu aqida.', 'bunny', 'SECRET-AQIDA');

-- The buyer owns the fiqh module only.
insert into public.entitlements (user_id, scope, course_id, delivery, expires_at)
values ('b0000000-0000-4000-8000-000000000001', 'course',
        'c1000000-0000-4000-8000-000000000001', 'online', now() + interval '300 days');
