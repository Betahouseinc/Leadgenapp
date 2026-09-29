-- 2026-09-26 — Nightly run status, and decision-maker contacts
--
-- Apply with:
--   npx supabase db query --linked -f supabase/migrations/20260926_daily_runs_and_contacts.sql
--
-- NOT `supabase db push`. This schema was built by hand and the migration ledger
-- is empty, so push would try to create objects that already exist.
--
-- Everything here is additive and idempotent.

-- ===========================================================================
-- PART 1 — The nightly run, actually scheduled and actually observable
-- ===========================================================================
--
-- 20260813_recent_searches_and_cron.sql defined the schedule, but
-- 20260818_job_slices.sql records that pg_cron was never installed on this
-- project — so the nightly run has most likely never fired. And when it does
-- fire there is no record of it: daily-scrape returned its results to pg_net,
-- which nobody reads.
--
-- daily_runs is that record. One row per invocation that had work to do.

create table if not exists public.daily_runs (
  id               uuid primary key default gen_random_uuid(),
  started_at       timestamptz not null default now(),
  heartbeat_at     timestamptz not null default now(),
  finished_at      timestamptz,
  -- running | completed | partial | failed
  --   partial = the invocation ran out of time budget and left searches for the
  --   next tick. Not a fault; the schedule fires several times a night for this.
  status           text not null default 'running',
  searches_total   integer not null default 0,
  searches_ok      integer not null default 0,
  searches_quota   integer not null default 0,
  searches_failed  integer not null default 0,
  -- Per search: {user_id, industry, city, status, saved}. Also how the next
  -- tick knows which searches were already attempted tonight, including ones
  -- that were rejected before scrape-leads wrote a scrape_runs row.
  results          jsonb not null default '[]'::jsonb,
  error_message    text
);

comment on column public.daily_runs.status is 'running | completed | partial | failed';

create index if not exists idx_daily_runs_started on public.daily_runs (started_at desc);

-- Admin-only reading; no policy means no access for authenticated users. The
-- edge function writes with the service role.
alter table public.daily_runs enable row level security;

-- Same failure mode as scrape_runs: a worker killed by the platform cannot
-- report its own death, so a row stuck in 'running' is closed by the next tick.
create or replace function public.reap_stalled_daily_runs(p_stale_minutes integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reaped integer;
begin
  update daily_runs
     set status        = 'failed',
         finished_at   = now(),
         error_message = coalesce(error_message,
           'This run stopped responding and was closed automatically. Searches it had already started keep running.')
   where status = 'running'
     and heartbeat_at < now() - make_interval(mins => p_stale_minutes);
  get diagnostics reaped = row_count;
  return reaped;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduling
--
-- Config now comes from Supabase Vault. `alter database ... set app.*` — which
-- the earlier migration asked for — is refused on current Supabase projects.
-- The old settings are still read as a fallback so nothing that did work stops.
--
-- One-time setup (SQL editor), then this migration needs nothing else:
--
--   select vault.create_secret('https://<REF>.supabase.co/functions/v1', 'leadgen_edge_url');
--   select vault.create_secret('<the CRON_SECRET value>',               'leadgen_cron_secret');
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_daily_scrape()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  begin
    select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'leadgen_edge_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'leadgen_cron_secret';
  exception when others then
    null;  -- Vault not available; fall through to the legacy settings.
  end;

  v_url    := coalesce(v_url,    current_setting('app.edge_url', true));
  v_secret := coalesce(v_secret, current_setting('app.cron_secret', true));

  if v_url is null or v_secret is null then
    insert into error_log (source, stage, message)
    values ('daily-scrape', 'config',
            'Vault secrets leadgen_edge_url / leadgen_cron_secret are not set - daily scrape skipped');
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/daily-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
end;
$$;

-- Every 15 minutes from 02:30 to 04:15 IST (21:00–22:45 UTC). Each tick takes
-- whatever tonight's queue still holds, works within a time budget, and stops.
-- A tick with nothing left writes the daily summaries and exits. This is what
-- keeps one invocation from outliving the platform's wall clock as users grow.
select cron.unschedule('leadgenai-daily-scrape')
 where exists (select 1 from cron.job where jobname = 'leadgenai-daily-scrape');

select cron.schedule(
  'leadgenai-daily-scrape',
  '*/15 21-22 * * *',
  $$ select public.trigger_daily_scrape(); $$
);

-- The earlier migration scheduled this too; re-assert it in case that one
-- never ran. prune_error_log() is defined in 20260813_error_log.sql.
select cron.unschedule('leadgenai-prune-errors')
 where exists (select 1 from cron.job where jobname = 'leadgenai-prune-errors');

select cron.schedule(
  'leadgenai-prune-errors',
  '30 23 * * *',
  $$ select public.prune_error_log(); $$
);

-- Is it working?
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select status, searches_total, searches_ok, searches_failed, started_at
--     from daily_runs order by started_at desc limit 10;

-- ===========================================================================
-- PART 2 — Decision-maker contacts, with deliverability
-- ===========================================================================
--
-- A lead is a business. The people at it — owner, founder, director — are a
-- separate list, found through Hunter's domain search when enrichment runs.
-- Kept in their own table rather than as columns on leads because a business
-- has several, and because the leads row already means "the business inbox".

create table if not exists public.lead_contacts (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid not null references public.leads(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  first_name          text,
  last_name           text,
  position            text,
  seniority           text,          -- junior | senior | executive (Hunter's scale)
  department          text,
  email               text not null,
  phone               text,
  linkedin_url        text,
  -- Hunter's 0–100 confidence that this address belongs to this person.
  confidence          integer,
  -- valid | accept_all | invalid | webmail | disposable | unknown
  --   accept_all means the server takes any address — deliverable, but a
  --   bounce cannot be ruled out. Only 'valid' is safe for cold outreach.
  email_status        text,
  email_verified_at   timestamptz,
  source              text not null default 'hunter',
  created_at          timestamptz not null default now()
);

create unique index if not exists uq_lead_contacts_lead_email
  on public.lead_contacts (lead_id, lower(email));
create index if not exists idx_lead_contacts_user on public.lead_contacts (user_id);

alter table public.lead_contacts enable row level security;

-- Read through lead_contacts_view below, which masks for free plans. No direct
-- select policy: a policy here would let the anon key read unmasked addresses.
drop policy if exists "Users delete own contacts" on public.lead_contacts;
create policy "Users delete own contacts" on public.lead_contacts
  for delete using (auth.uid() = user_id);

create or replace view public.lead_contacts_view as
select
  c.id, c.lead_id, c.user_id, c.first_name, c.last_name, c.position,
  c.seniority, c.department, c.confidence, c.email_status, c.email_verified_at,
  c.source, c.created_at,
  case when public.can_see_contacts() then c.email        else public.mask_email(c.email) end as email,
  case when public.can_see_contacts() then c.phone        else public.mask_phone(c.phone) end as phone,
  case when public.can_see_contacts() then c.linkedin_url else null end                      as linkedin_url,
  not public.can_see_contacts() as contacts_masked
from public.lead_contacts c
where c.user_id = auth.uid();   -- views bypass RLS; this filter is the boundary

grant select on public.lead_contacts_view to authenticated;

-- Deliverability of the business inbox found on the lead itself.
alter table public.leads
  add column if not exists email_status          text,
  add column if not exists email_verified_at     timestamptz,
  -- Set when a Hunter domain search completed for this lead, even with zero
  -- people found, so a second click does not spend another search credit.
  -- Left null when Hunter errored or was out of quota, so it can be retried.
  add column if not exists contacts_enriched_at  timestamptz;

comment on column public.leads.email_status is
  'Deliverability of leads.email: valid | accept_all | invalid | webmail | disposable | unknown. Null = not checked.';

-- leads_view is deliberately NOT recreated here to expose email_status. The live
-- view was built by hand and may not match 20260813_roles_and_masking.sql; a
-- `create or replace` that drops or reorders a live column fails this whole
-- file. Add it when the UI needs it, after checking the live definition:
--   select pg_get_viewdef('public.leads_view', true);
