-- ---------------------------------------------------------------------------
-- Where to push a notification
--
-- The office wants a new registration to reach the phone, not only the inbox.
-- Web Push needs no service and costs nothing: the browser hands us an endpoint
-- on its own vendor's push service, and a VAPID key pair is what proves the
-- message came from this site. What has to be stored is the endpoint and the
-- two keys the browser generated with it.
--
-- ONE ROW PER DEVICE, not per person. The same admin has a phone and a laptop,
-- and each browser mints its own subscription; `endpoint` is unique because
-- re-subscribing on the same device returns the same endpoint and must update
-- the row rather than pile up duplicates that all deliver the same buzz.
--
-- A subscription is not a secret in the sense a password is, but it IS a
-- capability: anyone holding one can make that device buzz. So the policies
-- below are owner-only — you may see and delete your own, and nobody else's,
-- including staff. There is deliberately no staff-read policy; the send path
-- reads these through the service role, because the caller at that moment is
-- the student who just registered and there is no staff session to read with.
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  -- Which device this is, so a person with three subscriptions can tell them
  -- apart before revoking one. Free-text from the browser; never interpreted.
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create trigger push_subscriptions_touch_updated_at
  before update on public.push_subscriptions
  for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;

create policy push_select_own on public.push_subscriptions for select
  to authenticated using (user_id = auth.uid());
create policy push_insert_own on public.push_subscriptions for insert
  to authenticated with check (user_id = auth.uid());
create policy push_update_own on public.push_subscriptions for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_delete_own on public.push_subscriptions for delete
  to authenticated using (user_id = auth.uid());

-- The grant is the first gate: `anon` has no privilege on this table at all, so
-- a stranger is refused before any policy is consulted.
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
