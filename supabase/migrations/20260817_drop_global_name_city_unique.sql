alter table public.leads
  drop constraint if exists leads_name_city_unique;

drop index if exists public.leads_name_city_unique;

alter table public.leads
  add column if not exists last_scraped_at timestamptz;

comment on column public.leads.last_scraped_at is
  'Last time a scrape run saw this business. Refreshed on duplicate; NULL for leads never re-seen since creation.';
