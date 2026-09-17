-- ---------------------------------------------------------------------------
-- Correcting a wrong choice
--
-- A student pays for the wrong module — a mis-click, a confusion between two
-- titles, a conversation at the desk that ended in the wrong basket. The money
-- is taken and the order is honest; what is wrong is which door it opened.
--
-- So this swaps ACCESS and leaves the money alone. No refund, no second
-- charge: a difference in price is the school's decision to make at the desk,
-- not something a form should do quietly.
--
-- The replacement keeps the REMAINING DAYS of what it replaces, so a
-- correction in month eleven does not hand over a fresh year, and it keeps
-- `source_order_id` pointing at the order that paid for it — the order's
-- "what this opened" stays true.
--
-- Every correction is a row, with who did it and why, and it is shown on the
-- order. The old entitlement is cancelled rather than deleted, for the same
-- reason every other revocation here is: history that can be rewritten is not
-- history.
-- ---------------------------------------------------------------------------

create table public.order_corrections (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  from_entitlement_id uuid references public.entitlements (id) on delete set null,
  from_label          text not null default '',
  to_label            text not null default '',
  to_course_id        uuid references public.courses (id) on delete set null,
  to_cursus_id        uuid references public.cursus (id) on delete set null,
  to_year_index       integer,
  to_delivery         public.delivery_mode not null,
  reason              text not null,
  actor_id            uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),

  constraint order_corrections_reason_present check (btrim(reason) <> '')
);

create index order_corrections_order_idx on public.order_corrections (order_id, created_at desc);

alter table public.order_corrections enable row level security;

-- Staff read; nobody writes through a session — the RPC below does.
create policy order_corrections_select_staff on public.order_corrections for select
  to authenticated using (public.is_staff());

grant select on public.order_corrections to authenticated;

-- ---------------------------------------------------------------------------
-- The swap
-- ---------------------------------------------------------------------------
create or replace function public.admin_correct_order(
  target_order uuid,
  old_entitlement uuid,
  new_course uuid,
  new_cursus uuid,
  new_year integer,
  reason text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  o public.orders%rowtype;
  old public.entitlements%rowtype;
  remaining interval;
  from_label text;
  created uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = 'insufficient_privilege';
  end if;
  if reason is null or btrim(reason) = '' then
    raise exception 'a reason is required to correct an order' using errcode = 'check_violation';
  end if;
  if (new_course is null) = (new_cursus is null) then
    raise exception 'choose exactly one replacement' using errcode = 'check_violation';
  end if;

  select * into o from public.orders where id = target_order for update;
  if not found then
    raise exception 'order % does not exist', target_order using errcode = 'no_data_found';
  end if;

  select * into old from public.entitlements where id = old_entitlement;
  if not found
     or old.user_id <> o.user_id
     or old.source_order_id is distinct from target_order
  then
    raise exception 'that entitlement was not bought by this order'
      using errcode = 'check_violation';
  end if;

  select coalesce(
           (select c.title from public.courses c where c.id = old.course_id),
           (select cu.title from public.cursus cu where cu.id = old.cursus_id),
           'Accès'
         ) into from_label;

  to_label := coalesce(
    (select c.title from public.courses c where c.id = new_course),
    (select cu.title from public.cursus cu where cu.id = new_cursus),
    'Accès'
  );

  -- What is left, not a fresh term: a correction must not extend what was paid
  -- for. Never negative — an expired row becomes a correction with a day.
  remaining := greatest(old.expires_at - now(), interval '1 day');

  update public.entitlements
     set status = 'cancelled',
         expires_at = least(expires_at, now()),
         starts_at = least(starts_at, now() - interval '1 second'),
         note = left('corrigé : ' || reason, 500)
   where id = old.id;

  if new_course is not null then
    insert into public.entitlements
      (user_id, scope, course_id, delivery, expires_at, source_order_id, granted_by, note)
    values
      (o.user_id, 'course', new_course, old.delivery, now() + remaining, target_order, actor,
       left('correction : ' || reason, 500))
    returning id into created;
  else
    insert into public.entitlements
      (user_id, scope, cursus_id, year_index, delivery, expires_at, source_order_id, granted_by, note)
    values
      (o.user_id, 'cursus', new_cursus, coalesce(new_year, 1), old.delivery, now() + remaining,
       target_order, actor, left('correction : ' || reason, 500))
    returning id into created;
  end if;

  insert into public.order_corrections
    (order_id, from_entitlement_id, from_label, to_label, to_course_id, to_cursus_id,
     to_year_index, to_delivery, reason, actor_id)
  values
    (target_order, old.id, from_label, to_label, new_course, new_cursus, new_year,
     old.delivery, left(reason, 500), actor);

  perform public.record_admin_action(
    'order.correct', 'order', target_order::text, reason,
    jsonb_build_object('from', old.id, 'to', created));

  return created;
end;
$$;

revoke all on function public.admin_correct_order(uuid, uuid, uuid, uuid, integer, text) from public;
grant execute on function public.admin_correct_order(uuid, uuid, uuid, uuid, integer, text) to authenticated, service_role;
