-- ---------------------------------------------------------------------------
-- The programme grid for the 2026 courses
--
-- Buying the approfondi opens every module the grid puts in the paid year, in
-- the mode paid for. This file fills that grid for the courses created from
-- the 2026 programme, so the modules that belong to the cursus are actually
-- in it — and the ones that are not are sold on their own only: their page
-- never offers the cursus.
--
-- Where each module sits comes from the school's programme:
--
--   Year 1   Fondements de la jurisprudence · La purification
--            Tajwid niveau 1 · Langue arabe niveau 1
--   Year 2   Prière et jeûne · ʿAqīdah — Allah et Ses messagers
--            Histoire — période mecquoise · Tajwid niveau 2
--            Langue arabe niveau 2
--   Year 3   Zakât et pèlerinage · Sciences du Coran
--            Tajwid niveau 3 et perfectionnement · Mémorisation du Coran
--            Langue arabe niveau 3
--
-- NOT in the grid, on purpose — sold as modules only:
--
--   the four teens modules (ʿAqīdah — Allah, prophètes et Livres ;
--   ʿAqīdah — destin et Jour du jugement ; Histoire — période médinoise ;
--   Histoire — des califes à aujourd'hui) and Nourania, which is the on-ramp
--   and belongs to no parcours.
--
-- Adjust any year in Admin → Cursus → the programme grid; this file is only
-- the first fill.
--
-- Idempotent: `on conflict do nothing`, so pasting it twice is harmless and it
-- never overwrites a tick the office has since changed. Matched by slug, so a
-- course that was never created is simply skipped.
--
-- Pure SQL for the Supabase SQL Editor: no transaction, no psql meta-commands.
-- ---------------------------------------------------------------------------

with programme (slug, year_index) as (
  values
    ('fondements-de-la-jurisprudence', 1),
    ('jurisprudence-la-purification', 1),
    ('tajwid-niveau-1', 1),
    ('langue-arabe-niveau-1', 1),
    ('jurisprudence-priere-et-jeune', 2),
    ('aqida-allah-et-ses-messagers', 2),
    ('histoire-periode-mecquoise', 2),
    ('tajwid-niveau-2', 2),
    ('langue-arabe-niveau-2', 2),
    ('jurisprudence-zakat-et-pelerinage', 3),
    ('sciences-du-coran', 3),
    ('tajwid-niveau-3-et-perfectionnement', 3),
    ('memorisation-du-coran', 3),
    ('langue-arabe-niveau-3', 3)
),
target as (
  -- The school runs one approfondi; take the first, so a second one added
  -- later does not silently receive every module of this file.
  select id from public.cursus where kind = 'approfondi' order by display_order limit 1
)
insert into public.cursus_courses (cursus_id, course_id, delivery, year_index, position)
select target.id, course.id, d.delivery, p.year_index, p.year_index
from programme p
join public.courses course on course.slug = p.slug
cross join (values ('presentiel'::public.delivery_mode), ('online'::public.delivery_mode)) as d (delivery)
cross join target
on conflict do nothing;
