-- 2026-08-13 — Error log for the scrape and scoring pipeline
--
-- There was no monitoring at all: a failing scrape wrote `status='failed'` to
-- scrape_runs and the reason was lost unless someone opened the function logs
-- inside the Supabase dashboard within the retention window.
--
-- A table rather than Sentry: no new dependency, no account, no DSN, and it is
-- queryable next to the data it describes. If a Sentry DSN is added later this
-- stays useful as the durable record.

create table if not exists error_log (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  source      text not null,          -- 'scrape-leads', 'daily-scrape', 'ui'
  stage       text,                   -- 'apify', 'scoring', 'insert', 'dedup'
  message     text not null,
  detail      jsonb,
  user_id     uuid,
  scrape_run_id uuid
);

create index if not exists idx_error_log_created on error_log (created_at desc);
create index if not exists idx_error_log_source  on error_log (source, created_at desc);

alter table error_log enable row level security;

-- The read policy below keys on profiles.role, which is created properly in
-- 20260813_roles_and_masking.sql — but that file sorts after this one, so the
-- column has to exist by the time this policy is created. Idempotent, and
-- deliberately duplicated rather than relying on migration ordering.
alter table profiles add column if not exists role text not null default 'rep';

-- Written by edge functions using the service role key, which bypasses RLS.
-- Only admins may read: messages can quote upstream payloads, so this is not
-- something to expose to every signed-in user.
drop policy if exists "Admins read error log" on error_log;
create policy "Admins read error log" on error_log
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Keeps the table from growing without bound. Called by the daily cron.
create or replace function public.prune_error_log()
returns void as $$
  delete from error_log where created_at < now() - interval '30 days';
$$ language sql;

-- Recent failures, newest first:
--   select created_at, source, stage, message from error_log order by 1 desc limit 50;
--
-- Failure rate by stage over the last week:
--   select stage, count(*) from error_log
--    where created_at > now() - interval '7 days' group by 1 order by 2 desc;
