-- ---------------------------------------------------------------------------
-- The student's photo
--
-- Stored as a KEY, not a URL. The bucket is private — there is no public base
-- URL anywhere in this codebase — so a stored URL would be a signed link that
-- expires, and every avatar on the site would go dark within the hour. The key
-- is the stable fact; the URL is minted when a page needs it, exactly as a
-- slide or a lesson video is served.
--
-- Two clauses, and the second is the one that matters. The first mirrors
-- `avatarKey()` in src/lib/storage/key.ts — the shape of a key we issue. The
-- second demands that the prefix IS this row's own user id, so a key naming
-- somebody else's object cannot be stored even by a service-role write. The
-- application checks the same thing before it signs anything; this is the
-- cheaper refusal and the one that cannot be forgotten.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists avatar_key text;

alter table public.profiles
  add constraint profiles_avatar_key_shape check (
    avatar_key is null
    or (
      avatar_key ~ '^avatars/[0-9a-f-]{36}/[A-Za-z0-9_-]{8,64}\.(png|jpg|webp)$'
      and avatar_key like 'avatars/' || id::text || '/%'
    )
  );

comment on column public.profiles.avatar_key is
  'R2 object key of the profile photo, never a URL. Signed when displayed.';

grant update (avatar_key) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Erasure reaches the photo too
--
-- The object itself is deleted by the admin action that calls this function —
-- Postgres cannot reach R2. What the function owes is the key: leaving it
-- behind would keep a pointer to a photo of a person who asked to be
-- forgotten, and the action would have nothing to delete.
-- ---------------------------------------------------------------------------

create or replace function public.admin_anonymise_user(target_user uuid, reason text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  revoked integer;
  existed boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;
  if reason is null or btrim(reason) = '' then
    raise exception 'a reason is required to erase an account' using errcode = 'check_violation';
  end if;

  if public.is_staff(target_user) then
    raise exception 'staff accounts cannot be anonymised' using errcode = 'check_violation';
  end if;

  select true into existed from public.profiles where id = target_user;
  if existed is null then return false; end if;

  update public.entitlements
     set status = 'cancelled',
         expires_at = least(expires_at, now()),
         starts_at = least(starts_at, now() - interval '1 second'),
         note = 'account anonymised'
   where user_id = target_user and status = 'active';
  get diagnostics revoked = row_count;

  -- Every identifying column, not only the two the first version knew about.
  update public.profiles
     set full_name = '',
         phone = null,
         civility = null,
         first_name = '',
         last_name = '',
         phone_landline = null,
         birth_date = null,
         address = '',
         postal_code = '',
         city = '',
         department = '',
         avatar_key = null,
         anonymised_at = coalesce(anonymised_at, now())
   where id = target_user;

  perform public.record_admin_action(
    'user.anonymise', 'user', target_user::text, reason,
    jsonb_build_object('entitlements_cancelled', revoked));
  return true;
end;
$$;

revoke all on function public.admin_anonymise_user(uuid, text) from public;
grant execute on function public.admin_anonymise_user(uuid, text) to authenticated, service_role;
