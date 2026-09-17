-- ---------------------------------------------------------------------------
-- Paying in three
--
-- The school sells a year of teaching; some families need to spread it. A
-- plan is THREE payments against ONE order, not three orders:
--
--   * The order keeps its real items and its real total, so the entitlement
--     the school grants, the invoice and the payments screen all still
--     describe what was bought.
--   * `paid_cents` accumulates. The order is marked paid when the FIRST
--     installment lands — that is when the student may study — and the
--     remaining balance lives on the same row.
--   * The schedule lives in `installments`: amount, due date and status for
--     each of the three. The second and third are invoices the student pays
--     when due, from their own space or at the desk; PayPal has no way to
--     charge a card on a schedule, and pretending otherwise would be a promise
--     the integration cannot keep.
--
-- Overdue is enforced where every other access question is enforced: inside
-- `has_course_access`. A modal can be dismissed; a policy cannot.
-- ---------------------------------------------------------------------------

create type public.installment_status as enum ('pending', 'paid', 'cancelled');

alter table public.orders
  add column if not exists plan_size  integer not null default 1,
  add column if not exists paid_cents integer not null default 0;

alter table public.orders
  add constraint orders_plan_size_sane check (plan_size between 1 and 12),
  add constraint orders_paid_cents_sane check (paid_cents >= 0 and paid_cents <= total_cents);

comment on column public.orders.plan_size is
  'How many payments this order is split into. 1 for the ordinary single payment.';
comment on column public.orders.paid_cents is
  'What has actually been collected so far. Equals total_cents once settled.';

create table public.installments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  sequence            integer not null,
  amount_cents        integer not null,
  due_at              timestamptz not null,
  status              public.installment_status not null default 'pending',
  -- PayPal's order id for THIS installment. Unique so a replayed callback
  -- cannot settle two installments with one capture.
  provider_order_id   text,
  provider_capture_id text,
  paid_at             timestamptz,
  coupon_id           uuid references public.coupons (id) on delete set null,
  created_at          timestamptz not null default now(),

  unique (order_id, sequence),
  constraint installments_amount_sane check (amount_cents > 0),
  constraint installments_sequence_sane check (sequence between 1 and 12),
  constraint installments_paid_has_date check (status <> 'paid' or paid_at is not null)
);

create unique index installments_provider_order_key
  on public.installments (provider_order_id)
  where provider_order_id is not null;

create index installments_due_idx
  on public.installments (due_at)
  where status = 'pending';

create index installments_order_idx on public.installments (order_id);

-- Who may see the schedule: the student it belongs to, and staff. Nothing
-- writes here through a session — the service role settles payments.
alter table public.installments enable row level security;

create policy installments_select_own on public.installments for select
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  ));

create policy installments_select_staff on public.installments for select
  to authenticated using (public.is_staff());

grant select on public.installments to authenticated;

-- ---------------------------------------------------------------------------
-- Reminder bookkeeping
--
-- One row per (installment, reminder) ever sent. The sweep claims the row with
-- `on conflict do nothing` BEFORE it sends, so two runs racing each other
-- cannot both send the same reminder — the database decides, not the caller's
-- timing. Service-role only: this is not the student's business.
-- ---------------------------------------------------------------------------
create table public.installment_notices (
  installment_id uuid not null references public.installments (id) on delete cascade,
  kind           text not null,
  sent_at        timestamptz not null default now(),

  primary key (installment_id, kind)
);

alter table public.installment_notices enable row level security;
grant select, insert, update, delete on public.installment_notices to service_role;

-- ---------------------------------------------------------------------------
-- An overdue installment closes the door
--
-- Added to `has_course_access` rather than to a policy of its own, because
-- that function is the single question every gate already asks — lessons,
-- lesson content, slides, live sessions. One place to change, one place to
-- test, and no gate that could forget.
--
-- Only an order with a plan can block: `source_order_id` points at the order
-- that granted the access, and an order of plan_size 1 has nothing pending.
-- ---------------------------------------------------------------------------
create or replace function public.has_course_access(cid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = uid
      and e.status = 'active'
      and e.expires_at > now()
      and (
        -- A comp or scholarship grant: the whole institute.
        e.scope = 'site'
        -- Bought this module outright.
        or (e.scope = 'course' and e.course_id = cid)
        -- Enrolled in a cursus whose programme covers it.
        or (e.scope = 'cursus' and exists (
              select 1 from public.cursus_courses cc
              where cc.cursus_id = e.cursus_id
                and cc.course_id = cid
                and cc.year_index = e.year_index
           ))
      )
      -- And nothing overdue on the plan that bought it.
      and not exists (
        select 1
        from public.installments i
        where i.order_id = e.source_order_id
          and i.status = 'pending'
          and i.due_at < now()
      )
  );
$$;

revoke all on function public.has_course_access(uuid, uuid) from public;
grant execute on function public.has_course_access(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The installments the sweep should remind about
--
-- Returns one row per (installment, reminder kind) that has NOT been sent yet,
-- within the windows the school asked for: a week before, the day before, and
-- on the day. Claiming happens in the same statement, so a second sweep run
-- gets nothing rather than sending twice.
-- ---------------------------------------------------------------------------
create or replace function public.claim_due_installment_notices()
returns table (
  installment_id uuid,
  order_id       uuid,
  user_id        uuid,
  kind           text,
  amount_cents   integer,
  due_at         timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with candidates as (
    select
      i.id,
      i.order_id,
      o.user_id,
      i.amount_cents,
      i.due_at,
      case
        when i.due_at < now() then 'due-0'
        when i.due_at < now() + interval '1 day' then 'due-1'
        when i.due_at < now() + interval '7 days' then 'due-7'
        else null
      end as kind
    from public.installments i
    join public.orders o on o.id = i.order_id
    where i.status = 'pending'
      and o.status = 'paid'
      and i.due_at < now() + interval '7 days'
  ),
  claimed as (
    insert into public.installment_notices (installment_id, kind)
    select c.id, c.kind from candidates c where c.kind is not null
    on conflict do nothing
    returning installment_id, kind
  )
  select c.id, c.order_id, c.user_id, c.kind, c.amount_cents, c.due_at
  from candidates c
  join claimed cl on cl.installment_id = c.id and cl.kind = c.kind;
$$;

revoke all on function public.claim_due_installment_notices() from public;
grant execute on function public.claim_due_installment_notices() to service_role;
