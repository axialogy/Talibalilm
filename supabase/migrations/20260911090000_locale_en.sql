-- ---------------------------------------------------------------------------
-- The second interface locale becomes English.
--
-- Arabic is dropped as a UI language, not as content: `courses.title_ar` still
-- holds the discipline's Arabic name for the cover art, and `courses.language`
-- still records that the Arabic-language course is taught in Arabic. Only
-- `profiles.locale` — which page a signed-in reader is served — changes here.
--
-- Postgres cannot remove a value from an enum in place, so the type is rebuilt
-- and the column rewritten through it. Anyone already sitting on 'ar' lands on
-- the default rather than being deleted.
-- ---------------------------------------------------------------------------

alter table public.profiles alter column locale drop default;

alter type public.app_locale rename to app_locale_v1;
create type public.app_locale as enum ('fr', 'en');

alter table public.profiles
  alter column locale type public.app_locale
  using (case when locale::text = 'en' then 'en' else 'fr' end)::public.app_locale;

alter table public.profiles alter column locale set default 'fr';

drop type public.app_locale_v1;

-- ALTER COLUMN ... TYPE keeps the column grants, but re-stating them costs
-- nothing and means this file can be read on its own.
grant update (full_name, phone, locale) on public.profiles to authenticated;

-- The signup trigger names the locale literally, so it is rewritten too.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    -- raw_user_meta_data is client-supplied, so anything but a known locale
    -- falls back to the default rather than failing the signup.
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en'::public.app_locale
         else 'fr'::public.app_locale end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
