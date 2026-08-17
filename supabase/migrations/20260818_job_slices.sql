-- Job-sliced lead generation.
--
-- Until now a scrape ran entirely inside one HTTP invocation: start Apify, poll
-- it, score every lead with Gemini, then insert. The platform kills a worker
-- that outlives its wall clock, and a killed worker never reaches its catch
-- block — so 14 runs died leaving no error and a scrape_runs row stranded in
-- 'running' forever. See LEADGENAI_STABILITY_AUDIT.md.
--
-- The work is now split into short slices that persist as they go, and
-- scrape_runs becomes the job record those slices resume from rather than a row
-- touched only at the start and the end. Everything below is additive: no
-- column is dropped or retyped, so the currently deployed function keeps working
-- until the new one replaces it.
--
-- Apply with:
--   npx supabase db query --linked -f supabase/migrations/20260818_job_slices.sql
--
-- NOT `supabase db push`. This schema was built by hand and the migration ledger
-- is empty, so push would try to create objects that already exist.

-- ---------------------------------------------------------------------------
-- scrape_runs: job state
-- ---------------------------------------------------------------------------

alter table public.scrape_runs
  -- Which Apify run this job is waiting on. Without it a resumed slice has no
  -- way to find the run its predecessor started, and would start a second one.
  add column if not exists apify_run_id     text,
  -- Where the job is in the pipeline: discovering / discovered / enriching /
  -- scoring / finalising. Drives the real progress display.
  add column if not exists stage            text,
  -- Per-stage counters. Reported to the user as actual progress rather than the
  -- elapsed-time guess the modal used to draw.
  add column if not exists discovered_count integer not null default 0,
  add column if not exists enriched_count   integer not null default 0,
  add column if not exists scored_count     integer not null default 0,
  add column if not exists failed_count     integer not null default 0,
  add column if not exists duplicate_count  integer not null default 0,
  -- Slices re-invoke the worker, so a bug could otherwise chain forever. The
  -- worker refuses to continue past a ceiling on this.
  add column if not exists attempts         integer not null default 0,
  -- Written at the top of every slice. A job whose heartbeat has gone quiet is
  -- one whose chain broke; that is the only way to tell it from one still
  -- working, since a killed worker cannot report its own death.
  add column if not exists heartbeat_at     timestamptz,
  add column if not exists started_at       timestamptz,
  add column if not exists finished_at      timestamptz,
  -- Contact enrichment is a per-run choice now, not a hardcoded actor flag, so
  -- the reliability/yield trade can be measured and changed without a deploy.
  add column if not exists enrich_contacts  boolean not null default true;

-- status now takes: queued | running | completed | partial | failed | cancelled
--
-- Deliberately NOT a check constraint. Existing rows predate these values and a
-- constraint that rejects history would fail this migration on a live table for
-- no benefit — the writers are two edge functions, not arbitrary clients.
comment on column public.scrape_runs.status is
  'queued | running | completed | partial | failed | cancelled';

-- Finding the jobs a resume sweep cares about. Partial, because terminal rows
-- are the overwhelming majority and are never scanned for this.
create index if not exists idx_scrape_runs_active
  on public.scrape_runs (heartbeat_at)
  where status in ('queued', 'running');

-- ---------------------------------------------------------------------------
-- leads: stable identity
-- ---------------------------------------------------------------------------

-- Google Maps' own identifier for a business. Dedup previously keyed on
-- name+city, so a business that changed its display name came back as new — and
-- "find only companies we have not seen" cannot be built on a display name.
alter table public.leads
  add column if not exists place_id text;

-- Partial: only rows that actually carry a place_id participate. Leads already
-- on file have none, and NULLs would not collide anyway — being explicit keeps
-- the index small and its intent obvious.
create unique index if not exists uq_leads_user_place_id
  on public.leads (user_id, place_id)
  where place_id is not null and place_id <> '';

-- The scoring slice asks for "this run's leads that still need a score". Without
-- this it seq-scans leads once per slice.
create index if not exists idx_leads_run_unscored
  on public.leads (scrape_run_id)
  where score is null;

-- ---------------------------------------------------------------------------
-- Stalled job reaper
-- ---------------------------------------------------------------------------

-- A slice chain can break in one place the job itself cannot report: the worker
-- is killed between slices. The row then sits in 'running' forever, which is
-- exactly the state one production row has been in since 2026-08-17 18:43.
--
-- Called at the start of each new job, so the sweep costs nothing extra and
-- needs no scheduler — pg_cron is not installed on this project.
create or replace function public.reap_stalled_scrape_runs(p_stale_minutes integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reaped integer;
begin
  update scrape_runs
     set status        = 'failed',
         finished_at   = now(),
         error_message = coalesce(
           error_message,
           'This run stopped responding and was closed automatically. Any leads it had already saved were kept.'
         )
   where status in ('queued', 'running')
     -- created_at covers a job that died before writing its first heartbeat.
     and coalesce(heartbeat_at, created_at) < now() - make_interval(mins => p_stale_minutes);

  get diagnostics reaped = row_count;
  return reaped;
end;
$$;

comment on function public.reap_stalled_scrape_runs(integer) is
  'Closes jobs whose slice chain broke. Leads already persisted are untouched.';
