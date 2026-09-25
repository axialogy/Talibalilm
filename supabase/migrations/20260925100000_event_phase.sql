-- ---------------------------------------------------------------------------
-- What stage an event is at
--
-- `status` says whether the office is showing the event at all — draft,
-- published, archived. That is a content switch, and it is what the public
-- policies and the home query read. This says where the event is in its own
-- life: still to come, happening now, over. The two are independent: a
-- finished event stays published because its page is still worth reading, and
-- a draft can be labelled "à venir" long before it is shown.
--
-- A new enum rather than more values on `catalog_status`, deliberately. That
-- one is shared by five tables and drives visibility in policies and partial
-- indexes, so widening it would change what "published" means for courses and
-- products as well. This enum has exactly one column.
--
-- No policy or grant changes: row-level security does not see columns, and the
-- table's grants already cover it.
-- ---------------------------------------------------------------------------

create type public.event_phase as enum ('upcoming', 'ongoing', 'finished');

alter table public.events
  add column phase public.event_phase not null default 'upcoming';

comment on column public.events.phase is
  'Where the event is in its own life — à venir, en cours, terminé. Independent of `status`, which decides whether it is shown at all.';
