-- ---------------------------------------------------------------------------
-- The two routes through the school are structure, not content
--
-- "Par module" and "Cursus Approfondi" are not things an office invents: the
-- checkout's first step offers exactly these two, `cursus_kind` is an enum with
-- exactly these two values, and every screen that talks about how a module is
-- sold assumes both exist. They were only ever created by `seed.sql`, which is
-- a first-install script full of demo courses that a real project never runs —
-- so on the live site they did not exist, and the module page's Cursus tab
-- correctly said so and sent the office to a screen that had been removed from
-- the sidebar.
--
-- A row the application cannot work without belongs in a migration.
--
-- Idempotent by KIND rather than by id or slug: if the school has already made
-- its own "Approfondi" under any name, this must leave it alone rather than
-- create a second one and split the modules between them.
-- ---------------------------------------------------------------------------

insert into public.cursus (slug, kind, title, subtitle, description, year_count, status, display_order)
select 'par-module', 'module',
       'Par module',
       'À la carte, un module à la fois',
       'Vous choisissez les modules qui vous intéressent et vous les suivez pendant un an. '
       'Une certification de présence est délivrée à la fin.',
       1, 'published', 0
where not exists (select 1 from public.cursus where kind = 'module');

insert into public.cursus (slug, kind, title, subtitle, description, year_count, status, display_order)
select 'cursus-approfondi', 'approfondi',
       'Cursus Approfondi',
       'Un programme structuré sur plusieurs années',
       'Une formation de fond, année par année, avec une certification agréée à la clé.',
       -- Five, because that is the maximum the module page offers; a school
       -- running three simply leaves years four and five unticked.
       5, 'published', 1
where not exists (select 1 from public.cursus where kind = 'approfondi');
