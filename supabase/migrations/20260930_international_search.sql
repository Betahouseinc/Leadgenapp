-- 2026-09-30 — Searches outside India
--
-- Every search was hardcoded to India: the worker appended ", India" to the
-- query and set regionCode IN. A search is now a city within a country, and the
-- country is stored on the job and on each lead it produces.
--
-- Apply in the SQL editor, or:
--   npx supabase db query --linked -f supabase/migrations/20260930_international_search.sql

-- ISO 3166-1 alpha-2. Every job before this change searched India.
alter table public.scrape_runs
  add column if not exists country text not null default 'IN';

alter table public.leads
  add column if not exists country text;

comment on column public.scrape_runs.country is 'ISO 3166-1 alpha-2 country the search ran in.';
comment on column public.leads.country is 'ISO 3166-1 alpha-2 country of the search that found this lead. Null on some pre-2026-09-30 rows.';

-- Backfill existing leads from the address Places returned, which ends in the
-- country name. Only the two countries actually present; anything else stays
-- null rather than guessed.
update public.leads set country = 'IN'
 where country is null and address ilike '%, india';
update public.leads set country = 'AU'
 where country is null and address ilike '%, australia';

-- 20260930_close_plan_bypasses.sql grants leads columns to users one by one, so
-- a new column is unreadable until it is listed. Country is not contact data.
grant select (country) on public.leads to authenticated;

-- The nightly job re-runs each distinct search; country is now part of what
-- makes a search distinct. Appended as the last column, which is the only
-- change create-or-replace allows on a view.
create or replace view public.recent_searches as
select
  r.user_id,
  r.industry,
  r.city,
  max(r.created_at)                                   as last_run_at,
  count(*)                                            as run_count,
  coalesce(sum(r.leads_saved), 0)                     as leads_saved_total,
  coalesce(
    (array_agg(r.limit_requested order by r.created_at desc))[1],
    20
  )                                                   as last_limit,
  r.country
from scrape_runs r
where r.industry is not null
  and r.city is not null
group by r.user_id, r.industry, r.city, r.country
order by max(r.created_at) desc;

-- Replacing a view keeps its grants, but restate the service-role-only rule so
-- this file is correct on its own.
revoke all on public.recent_searches from anon, authenticated;
