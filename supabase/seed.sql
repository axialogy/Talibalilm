-- ---------------------------------------------------------------------------
-- Starter catalogue.
--
-- NOT a migration. This is the school's opening content, meant to be edited in
-- the admin screens the moment it lands — every price here is a placeholder
-- for the school to change, not a decision baked into the code.
--
-- Paste it into the Supabase SQL editor, or run it with psql. It is
-- idempotent, so running it twice changes nothing.
--
-- Pure SQL: no psql meta-commands, because the SQL editor rejects them and
-- rolls back the entire paste when it hits one.
--
-- What it sets up, from the school's own planning page:
--   * Two disciplines — Sciences du Coran and Sciences du Fiqh.
--   * Two cursus — Base (à la carte) and Approfondi (four years, two subjects
--     a year).
--   * Each discipline offered in both delivery modes and both time slots, at
--     300 € as a starting price.
--   * One example offer, to show the shape.
-- ---------------------------------------------------------------------------

-- --- the two disciplines ---------------------------------------------------

insert into public.courses
  (id, slug, title, subtitle, description, title_ar, category, level, format,
   language, status, published_at, display_order, schedule, duration_weeks, objectives)
values
  ('7c000000-0000-4000-8000-000000000001', 'sciences-du-coran',
   'Sciences du Coran',
   'Mémorisation, tajwid et étude approfondie du texte coranique',
   'Étude des sciences du Coran : révélation, collecte, lecture, règles de récitation et introduction à l’exégèse.',
   'علوم القرآن', 'coran', 'all', 'hybride', 'fr', 'published', now(), 1,
   'Vendredi 18h30-21h30 ou samedi 9h-13h', 30,
   '["Lire correctement selon les règles du tajwid", "Situer la révélation dans son contexte", "Aborder un texte coranique avec méthode"]'::jsonb),

  ('7c000000-0000-4000-8000-000000000002', 'sciences-du-fiqh',
   'Sciences du Fiqh',
   'Jurisprudence des actes cultuels et des pratiques quotidiennes',
   'Étude du fiqh : purification, prière, jeûne, zakat et pratiques cultuelles, à partir des sources et des écoles reconnues.',
   'علوم الفقه', 'fiqh', 'all', 'hybride', 'fr', 'published', now(), 2,
   'Vendredi 18h30-21h30 ou samedi 9h-13h', 30,
   '["Connaître les règles des actes cultuels", "Remonter d’une règle à sa source", "Distinguer les avis des écoles reconnues"]'::jsonb)
on conflict (id) do nothing;

-- --- the two cursus --------------------------------------------------------

insert into public.cursus (id, slug, kind, title, subtitle, description, year_count, status, display_order)
values
  ('7f000000-0000-4000-8000-000000000001', 'cursus-de-base', 'module',
   'Cursus de Base',
   'Les matières à la carte, pour un an',
   'Vous choisissez les matières qui vous intéressent et vous les suivez pendant 365 jours, en présentiel ou en visioconférence.',
   1, 'published', 1),

  ('7f000000-0000-4000-8000-000000000002', 'cursus-approfondi', 'approfondi',
   'Cursus Approfondi',
   'Formation sur quatre ans',
   'Accessible aux personnes ayant déjà suivi des cours en sciences islamiques ou sur validation par test. Seules deux matières sont étudiées par année, pour approfondir les connaissances.',
   4, 'published', 2)
on conflict (id) do nothing;

-- --- the programme ---------------------------------------------------------
-- Year 1 of the Approfondi covers both disciplines, in either mode. The school
-- fills in years 2 to 4 as the syllabus is published — the planning page calls
-- them "bientôt disponible" today.

insert into public.cursus_courses (cursus_id, course_id, delivery, year_index, position)
select '7f000000-0000-4000-8000-000000000002', course_id, delivery, 1, position
from (values
  ('7c000000-0000-4000-8000-000000000001'::uuid, 1),
  ('7c000000-0000-4000-8000-000000000002'::uuid, 2)
) as c (course_id, position)
cross join (values ('presentiel'::public.delivery_mode), ('online'::public.delivery_mode)) as d (delivery)
on conflict do nothing;

-- --- the price list --------------------------------------------------------
-- Each discipline, in each delivery mode, in each of the school's two slots.
-- 300 € across the board as an opening price; the admin screens are where this
-- actually gets decided.

insert into public.products
  (kind, course_id, delivery, time_slot, schedule_label, hours_per_year,
   hours_per_week, language, price_cents, duration_days, status, display_order)
select
  'module', c.course_id, d.delivery, s.slot, s.label, 90, 30, 'fr',
  30000, 365, 'published', c.position
from (values
  ('7c000000-0000-4000-8000-000000000001'::uuid, 1),
  ('7c000000-0000-4000-8000-000000000002'::uuid, 2)
) as c (course_id, position)
cross join (values ('presentiel'::public.delivery_mode), ('online'::public.delivery_mode)) as d (delivery)
cross join (values
  ('semaine-soir', 'Vendredi 18h30-21h30'),
  ('weekend-matin', 'Samedi 9h-13h')
) as s (slot, label)
on conflict do nothing;

-- Year 1 of the Approfondi, priced at its two subjects. A placeholder like the
-- rest: the school sets the real figure.
insert into public.products
  (kind, cursus_id, year_index, delivery, time_slot, schedule_label,
   hours_per_year, hours_per_week, language, price_cents, duration_days, status, display_order)
select
  'cursus', '7f000000-0000-4000-8000-000000000002', 1, d.delivery,
  'dimanche', 'Dimanche 9h-13h', 120, 40, 'fr', 60000, 365, 'published', 1
from (values ('presentiel'::public.delivery_mode), ('online'::public.delivery_mode)) as d (delivery)
on conflict do nothing;

-- --- one example offer -----------------------------------------------------
-- Take the two disciplines together online and the second is free. Left as a
-- DRAFT so nothing is on sale until the school has looked at it.

insert into public.packs (id, slug, title, description, delivery, pricing, status, display_order)
values ('7a000000-0000-4000-8000-000000000001', 'coran-et-fiqh',
        'Coran + Fiqh',
        'Prenez les Sciences du Coran et les Sciences du Fiqh ensemble : la seconde matière est offerte.',
        'online', 'sum', 'draft', 1)
on conflict (id) do nothing;

insert into public.pack_items (pack_id, product_id, is_free, position)
select '7a000000-0000-4000-8000-000000000001', p.id,
       p.course_id = '7c000000-0000-4000-8000-000000000002', 
       case when p.course_id = '7c000000-0000-4000-8000-000000000001' then 1 else 2 end
from public.products p
where p.kind = 'module' and p.delivery = 'online' and p.time_slot = 'semaine-soir'
on conflict do nothing;

-- Confirm with:
--   select (select count(*) from public.courses)  as courses,
--          (select count(*) from public.cursus)   as cursus,
--          (select count(*) from public.products) as products;
-- Expect 2, 2, 10.
