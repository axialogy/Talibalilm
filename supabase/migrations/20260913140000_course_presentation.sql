-- What a module's page says about itself.
--
-- The catalogue could describe a course in one paragraph and a list of
-- objectives. The school's own page says more than that, and says it in a
-- fixed order: which department the module belongs to, who may enrol, three
-- things worth knowing at a glance, and a few photographs. All of it was
-- previously hard-coded in the template, which meant the office could not
-- change a word without a deploy.
--
-- So it becomes data, filled in from the admin panel like everything else.
-- Every column is optional and defaults to empty: a module that says nothing
-- extra renders exactly as it did before, without the section.
--
-- No new policy. These are columns on `courses`, which already decides who may
-- read and who may write; the grants there are table-level, so they cover
-- these too. The RLS suite proves that a draft course stays invisible, and
-- that holds for whatever is written in these columns.

alter table public.courses
  -- "Département et Sciences Islamiques (DES)" — the heading of the block that
  -- places the module inside the school, and the prose under it.
  add column if not exists department       text  not null default '',
  add column if not exists department_body  text  not null default '',
  -- Conditions d'accès, one bullet per entry.
  add column if not exists requirements     jsonb not null default '[]'::jsonb,
  -- Three short "what you get" blocks: [{ "title": "...", "body": "..." }].
  add column if not exists highlights       jsonb not null default '[]'::jsonb,
  -- Photographs for the Informations carousel: [{ "url": "...", "alt": "..." }].
  add column if not exists gallery          jsonb not null default '[]'::jsonb;

-- Shape, not content. A malformed payload from a future admin screen should be
-- refused here rather than reaching a `.map()` on the public page.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'courses_requirements_is_array') then
    alter table public.courses
      add constraint courses_requirements_is_array check (jsonb_typeof(requirements) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_highlights_is_array') then
    alter table public.courses
      add constraint courses_highlights_is_array check (jsonb_typeof(highlights) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_gallery_is_array') then
    alter table public.courses
      add constraint courses_gallery_is_array check (jsonb_typeof(gallery) = 'array');
  end if;
end $$;

comment on column public.courses.department is
  'Which department the module sits in, shown as the heading of its first block.';
comment on column public.courses.requirements is
  'Conditions d''accès, a JSON array of strings.';
comment on column public.courses.highlights is
  'A JSON array of { title, body } shown as the three icon blocks.';
comment on column public.courses.gallery is
  'A JSON array of { url, alt } shown as the Informations carousel.';
