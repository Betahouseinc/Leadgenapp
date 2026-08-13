-- 2026-08-13 — Saved searches, daily scheduling, and the daily summary
--
-- Scraping was manual-click only. This adds per-user saved searches that a
-- nightly job runs unattended, and a summary of new + high-scoring leads that a
-- separate notifier can pick up and email.

-- ---------------------------------------------------------------------------
-- 1. Recent searches
--
-- Every scrape already writes a scrape_runs row, so the list of searches a user
-- runs is captured automatically — there is nothing to save separately. An
-- earlier draft of this migration added a saved_searches table, which was just
-- a second copy of data scrape_runs already holds, and one the user would have
-- had to maintain by hand.
--
-- What was actually missing was ordering: the history has no notion of "most
-- recent search" without collapsing repeat runs of the same industry+city.
-- ---------------------------------------------------------------------------

drop table if exists saved_searches;

create or replace view public.recent_searches as
select
  r.user_id,
  r.industry,
  r.city,
  max(r.created_at)                                   as last_run_at,
  count(*)                                            as run_count,
  coalesce(sum(r.leads_saved), 0)                     as leads_saved_total,
  -- The most recent request size is the best guide to what the user wants
  -- next time; falls back to a modest default for very old rows.
  coalesce(
    (array_agg(r.limit_requested order by r.created_at desc))[1],
    20
  )                                                   as last_limit
from scrape_runs r
where r.industry is not null
  and r.city is not null
group by r.user_id, r.industry, r.city
order by max(r.created_at) desc;

grant select on public.recent_searches to authenticated;

-- Views do not inherit the base table's RLS, so anything reading this for a
-- signed-in user must filter on user_id. The nightly job uses the service role
-- and scopes per user explicitly.
create index if not exists idx_scrape_runs_user_created
  on scrape_runs (user_id, created_at desc);

-- What the dashboard would show, newest first:
--   select * from recent_searches where user_id = auth.uid();

-- ---------------------------------------------------------------------------
-- 2. Daily summary
--
-- Returns new + high-scoring leads for one user over a window. A notifier reads
-- this; it deliberately does not send anything itself, matching the existing
-- rule that a human approves every outbound message.
--
-- Contact fields are NOT masked here: this is invoked by the service role on
-- behalf of the account owner, who is entitled to their own data. Do not
-- expose it to the anon key.
-- ---------------------------------------------------------------------------

create or replace function public.daily_lead_summary(
  p_user_id uuid,
  p_since   timestamptz default now() - interval '1 day',
  p_min_score int default 70
)
returns json as $$
  select json_build_object(
    'user_id',     p_user_id,
    'since',       p_since,
    'generated_at', now(),
    'new_count',   (select count(*) from leads
                     where user_id = p_user_id and created_at >= p_since),
    'high_count',  (select count(*) from leads
                     where user_id = p_user_id and created_at >= p_since
                       and score >= p_min_score),
    'leads', coalesce((
      select json_agg(row_to_json(t) order by t.score desc nulls last)
        from (
          select id, name, email, phone, website, industry, city,
                 score, summary, source, created_at
            from leads
           where user_id = p_user_id
             and created_at >= p_since
             and (score >= p_min_score or score is null)
           order by score desc nulls last
           limit 500
        ) t
    ), '[]'::json)
  );
$$ language sql stable security definer;

-- ---------------------------------------------------------------------------
-- 2b. Where the summaries land
--
-- The nightly job writes here; a notifier reads unsent rows, emails them, and
-- stamps sent_at. Splitting generation from sending means a failed email does
-- not lose the summary, and nothing is sent without something else choosing to.
-- ---------------------------------------------------------------------------

create table if not exists daily_summaries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  new_count  int not null default 0,
  high_count int not null default 0,
  payload    jsonb not null,
  sent_at    timestamptz
);

create index if not exists idx_daily_summaries_unsent
  on daily_summaries (created_at) where sent_at is null;

alter table daily_summaries enable row level security;

drop policy if exists "Users read own summaries" on daily_summaries;
create policy "Users read own summaries" on daily_summaries
  for select using (auth.uid() = user_id);

-- The notifier's queue:
--   select * from daily_summaries where sent_at is null order by created_at;

-- ---------------------------------------------------------------------------
-- 3. Scheduling
--
-- pg_cron and pg_net are both available on Supabase at no cost. The job posts
-- to the edge function rather than doing the work in SQL, because the scrape
-- needs Apify and Gemini.
--
-- Replace <PROJECT_REF> and set the two settings below before this will work:
--
--   alter database postgres set app.edge_url   = 'https://<REF>.functions.supabase.co';
--   alter database postgres set app.cron_secret = '<the CRON_SECRET value>';
--
-- The secret is what the edge function checks; without it the scheduled path
-- would be an unauthenticated way to trigger scrapes for any account.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_daily_scrape()
returns void as $$
declare
  v_url    text := current_setting('app.edge_url', true);
  v_secret text := current_setting('app.cron_secret', true);
begin
  if v_url is null or v_secret is null then
    insert into error_log (source, stage, message)
    values ('daily-scrape', 'config',
            'app.edge_url or app.cron_secret is not set - daily scrape skipped');
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/daily-scrape',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', v_secret
               ),
    body    := '{}'::jsonb
  );
end;
$$ language plpgsql security definer;

-- 02:30 IST = 21:00 UTC. Overnight so a long run does not compete with
-- interactive scrapes during the working day.
select cron.unschedule('leadgenai-daily-scrape')
 where exists (select 1 from cron.job where jobname = 'leadgenai-daily-scrape');

select cron.schedule(
  'leadgenai-daily-scrape',
  '0 21 * * *',
  $$ select public.trigger_daily_scrape(); $$
);

select cron.unschedule('leadgenai-prune-errors')
 where exists (select 1 from cron.job where jobname = 'leadgenai-prune-errors');

select cron.schedule(
  'leadgenai-prune-errors',
  '30 22 * * *',
  $$ select public.prune_error_log(); $$
);

-- select * from cron.job;
-- select * from cron.job_run_details order by start_time desc limit 20;
